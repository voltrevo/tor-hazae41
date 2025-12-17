import { Writable } from '../../../binary/mod';
import { HalfDuplex } from '../../../cascade/index';
import { test } from '../../../phobos/mod';
import { relative, resolve } from 'path';
import { KcpDuplex } from './stream/index';
import { Opaque } from '../../../asn1/mods/triplets/opaque/opaque';

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

const conversation = 12345;

function pipeToKcp(raw: { outer: ReadableWritablePair<Opaque, Writable> }): {
  outer: ReadableWritablePair<Opaque, Writable>;
} {
  const kcp = new KcpDuplex({ conversation });

  raw.outer.readable.pipeTo(kcp.inner.writable).catch(() => {});

  kcp.inner.readable.pipeTo(raw.outer.writable).catch(() => {});

  return kcp;
}

function pipeToDummy(
  prefix: string,
  kcp: { outer: ReadableWritablePair<Opaque, Writable> }
) {
  const dummy = new Dummy(prefix);

  kcp.outer.readable.pipeTo(dummy.inner.writable).catch(() => {});

  dummy.inner.readable.pipeTo(kcp.outer.writable).catch(() => {});

  return dummy;
}

class Dummy extends HalfDuplex<Opaque, Writable> {
  constructor(readonly prefix: string) {
    super({ input: { write: m => this.#onMessage(m) } });
  }

  #onMessage(data: Opaque) {
    console.log(this.prefix, data.bytes);
  }

  send(data: Writable) {
    this.output.enqueue(data);
  }
}

test('kcp', async () => {
  const forward = new TransformStream<Writable, Opaque>({
    transform: (chunk, controller) =>
      controller.enqueue(Opaque.writeFromOrThrow(chunk)),
  });
  const backward = new TransformStream<Writable, Opaque>({
    transform: (chunk, controller) =>
      controller.enqueue(Opaque.writeFromOrThrow(chunk)),
  });

  const rawA = {
    outer: { readable: forward.readable, writable: backward.writable },
  };
  const rawB = {
    outer: { readable: backward.readable, writable: forward.writable },
  };

  const kcpA = pipeToKcp(rawA);
  const kcpB = pipeToKcp(rawB);

  const dummyA = pipeToDummy('a', kcpA);
  const dummyB = pipeToDummy('b', kcpB);

  dummyA.send(new Opaque(new Uint8Array([1, 2, 3])));
  dummyB.send(new Opaque(new Uint8Array([4, 5, 6])));
});
