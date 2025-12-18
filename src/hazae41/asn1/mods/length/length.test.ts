import { Base16 } from '../../../base16/index';
import { Writable } from '../../../binary/mod';
import { Cursor } from '../../../cursor/mod';
import { assert, test } from '../../../phobos/mod';
import { Length } from './length';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Base16.padStartAndDecodeOrThrow(hex2);
  return new Cursor(buffer);
}

function hexToLength(hex: string) {
  const cursor = hexToCursor(hex);
  const length = Length.DER.readOrThrow(cursor);
  return length.value;
}

test('Read', async () => {
  assert(hexToLength('82 01 7F') === 383);
  assert(hexToLength('82 04 92') === 1170);
});

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const length = Length.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(length);
  return Buffer.from(input.bytes).equals(Buffer.from(output));
}

test('Read then write', async () => {
  assert(checkReadWrite('82 01 7F'));
  assert(checkReadWrite('82 04 92'));
});
