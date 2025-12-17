import { Base16 } from '../../../../base16/index.ts';
import { Writable } from '../../../../binary/mod.ts';
import { Cursor } from '../../../../cursor/mod.ts';
import { assert, test } from '../../../../phobos/mod.ts';
import { BitString } from './bit_string.ts';
import { relative, resolve } from 'node:path';

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
  const triplet = BitString.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Buffer.from(input.bytes).equals(Buffer.from(output));
}

test('Read then write', async () => {
  assert(
    checkReadWrite(
      '03 41 00 6F 73 77 BE 28 96 5A 33 36 D7 E5 34 FD 90 F3 FD 40 7F 1F 02 F9 00 57 F2 16 0F 16 6B 04 BF 65 84 B6 98 D2 D0 D2 BF 4C D6 6F 0E B6 E2 E8 9D 04 A3 E0 99 50 F9 C2 6D DE 73 AD 1D 35 57 85 65 86 06'
    )
  );
});
