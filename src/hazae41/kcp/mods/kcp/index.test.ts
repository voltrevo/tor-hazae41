import { Writable, Unknown } from '../../../binary/mod';
import { HalfDuplex } from '../../../cascade/index';
import { test } from '../../../phobos/mod';
import { Bytes } from '../../../bytes/index';
import { KcpDuplex } from './stream/index';


const conversation = 12345;

function pipeToKcp(raw: { outer: ReadableWritablePair<Unknown, Writable> }): {
  outer: ReadableWritablePair<Unknown, Writable>;
} {
  const kcp = new KcpDuplex({ conversation });

  raw.outer.readable.pipeTo(kcp.inner.writable).catch(() => {});

  kcp.inner.readable.pipeTo(raw.outer.writable).catch(() => {});

  return kcp;
}

function pipeToDummy(
  prefix: string,
  kcp: { outer: ReadableWritablePair<Unknown, Writable> }
) {
  const dummy = new Dummy(prefix);

  kcp.outer.readable.pipeTo(dummy.inner.writable).catch(() => {});

  dummy.inner.readable.pipeTo(kcp.outer.writable).catch(() => {});

  return dummy;
}

class Dummy extends HalfDuplex<Unknown, Writable> {
  constructor(readonly prefix: string) {
    super({ input: { write: m => this.#onMessage(m) } });
  }

  #onMessage(data: Unknown) {
    console.log(this.prefix, data.bytes);
  }

  send(data: Writable) {
    this.output.enqueue(data);
  }
}

test('kcp', async () => {
  const forward = new TransformStream<Writable, Unknown>({
    transform: (chunk, controller) =>
      controller.enqueue(Unknown.writeFromOrThrow(chunk)),
  });
  const backward = new TransformStream<Writable, Unknown>({
    transform: (chunk, controller) =>
      controller.enqueue(Unknown.writeFromOrThrow(chunk)),
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

  dummyA.send(new Unknown(Bytes.from([1, 2, 3])));
  dummyB.send(new Unknown(Bytes.from([4, 5, 6])));
});
