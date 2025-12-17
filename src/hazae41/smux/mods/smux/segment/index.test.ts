import { Readable, Writable } from '../../../../binary/mod';
import { assert, test } from '../../../../phobos/mod';
import { relative, resolve } from 'path';
import { SmuxSegment } from './index';
import { Opaque } from '../../../../asn1/mods/triplets/opaque/opaque';
import { Bytes } from '../../../../bytes';

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

test('kcp segment', async () => {
  const version = 2;
  const command = SmuxSegment.commands.psh;
  const stream = 12345;
  const fragment = new Opaque(crypto.getRandomValues(new Bytes(130)));

  const segment = SmuxSegment.newOrThrow({
    version,
    command,
    stream,
    fragment,
  });
  const bytes = Writable.writeToBytesOrThrow(segment);
  const frame2 = Readable.readFromBytesOrThrow(SmuxSegment, bytes);

  assert(Bytes.equals(segment.fragment.bytes, frame2.fragment.bytes));
});
