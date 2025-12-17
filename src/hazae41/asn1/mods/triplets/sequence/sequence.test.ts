import { Base16 } from '../../../../base16/index.ts';
import { Writable } from '../../../../binary/mod.ts';
import { Cursor } from '../../../../cursor/mod.ts';
import { assert, test } from '../../../../phobos/mod.ts';
import { DER } from '../../resolvers/der/index.ts';
import { relative, resolve } from 'node:path';
import { Sequence } from './sequence';

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Base16.padStartAndDecodeOrThrow(hex2);
  return new Cursor(buffer);
}

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const triplet = DER.readOrThrow(input);

  assert(triplet instanceof Sequence);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Buffer.from(input.bytes).equals(Buffer.from(output));
}

test('Read then write', async () => {
  assert(checkReadWrite('30 0D 06 09 2A 86 48 86 F7 0D 01 01 01 05 00'));
});
