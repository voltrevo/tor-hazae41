import { Base16 } from '../../../../base16/index.ts';
import { Writable } from '../../../../binary/mod.ts';
import { Cursor } from '../../../../cursor/mod.ts';
import { assert, test } from '../../../../phobos/mod.ts';
import { UTCTime } from './utc_time.ts';
import { relative, resolve } from 'node:path';

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Base16.padStartAndDecodeOrThrow(hex2);
  return new Cursor(buffer);
}

function hexToDate(hex: string) {
  const input = hexToCursor(hex);
  return UTCTime.DER.readOrThrow(input).value.toUTCString();
}

function reformatDate(text: string) {
  const date = new Date(text);
  return date.toUTCString();
}

test('Read', async () => {
  assert(
    hexToDate('17 0D 31 39 30 39 32 39 31 36 33 33 33 36 5A') ===
      reformatDate('2019-09-29 16:33:36 UTC')
  );
  assert(
    hexToDate('17 0D 31 39 31 32 32 38 31 36 33 33 33 36 5A') ===
      reformatDate('2019-12-28 16:33:36 UTC')
  );
});

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const triplet = UTCTime.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Buffer.from(input.bytes).equals(Buffer.from(output));
}

test('Read then write', async () => {
  assert(checkReadWrite('17 0D 31 39 30 39 32 39 31 36 33 33 33 36 5A'));
  assert(checkReadWrite('17 0D 31 39 31 32 32 38 31 36 33 33 33 36 5A'));
  assert(checkReadWrite('17 0D 30 37 31 32 30 37 31 30 32 31 34 36 5A'));
});
