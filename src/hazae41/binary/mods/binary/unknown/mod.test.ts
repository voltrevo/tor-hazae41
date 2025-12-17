// deno-lint-ignore-file no-unused-vars require-await
import { assert, test } from '../../../../phobos/mod';
import { Buffer } from 'node:buffer';
import { relative, resolve } from 'node:path';
import { Readable } from '../readable/mod';
import { Unknown } from './mod';
import { Bytes } from '../../../../bytes';

function equals(a: Bytes, b: Bytes) {
  return Buffer.from(a).equals(Buffer.from(b));
}

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

test('Opaque', async () => {
  const bytes = Bytes.from([1, 2, 3, 4, 5]);

  const opaque = Readable.readFromBytesOrThrow(Unknown, bytes);
  const opaque2 = opaque.readIntoOrThrow(Unknown).cloneOrThrow();
  const opaque3 = Unknown.writeFromOrThrow(opaque2);

  assert(equals(opaque.bytes, opaque2.bytes));
  assert(equals(opaque2.bytes, opaque3.bytes));
});
