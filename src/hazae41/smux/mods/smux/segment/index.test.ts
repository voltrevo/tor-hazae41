import { Opaque, Readable, Writable } from '../../../../binary/mod.ts';
import { assert, test } from '../../../../phobos/mod.ts';
import { Bytes } from '../../../libs/bytes/index.ts';
import { relative, resolve } from 'path';
import { SmuxSegment } from './index';

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

test('kcp segment', async ({ test }) => {
  const version = 2;
  const command = SmuxSegment.commands.psh;
  const stream = 12345;
  const fragment = new Opaque(crypto.getRandomValues(new Uint8Array(130)));

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
