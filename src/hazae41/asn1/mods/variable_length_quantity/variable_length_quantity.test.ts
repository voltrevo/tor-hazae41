import { Writable } from '../../../binary/mod';
import { Bytes } from '../../../bytes';
import { Cursor } from '../../../cursor/mod';
import { assert, test } from '../../../phobos/mod';
import { VLQ } from './variable_length_quantity';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Bytes.fromHexAllowMissing0(hex2);
  return new Cursor(buffer);
}

function hexToVLQ(hex: string) {
  const cursor = hexToCursor(hex);
  return VLQ.DER.readOrThrow(cursor).value;
}

test('Read', async () => {
  assert(hexToVLQ('00') === 0);
  assert(hexToVLQ('7F') === 127);
  assert(hexToVLQ('81 00') === 128);
  assert(hexToVLQ('C0 00') === 8192);
  assert(hexToVLQ('FF 7F') === 16383);
  assert(hexToVLQ('81 80 00') === 16384);
  assert(hexToVLQ('FF FF 7F') === 2097151);
  assert(hexToVLQ('81 80 80 00') === 2097152);
  assert(hexToVLQ('C0 80 80 00') === 134217728);
  assert(hexToVLQ('FF FF FF 7F') === 268435455);
});

function checkReadWriteVLQ(hex: string) {
  const input = hexToCursor(hex);
  const vlq = VLQ.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(vlq);
  return Bytes.equals(input.bytes, output);
}

test('Read then write', async () => {
  assert(checkReadWriteVLQ('00'));
  assert(checkReadWriteVLQ('7F'));
  assert(checkReadWriteVLQ('81 00'));
  assert(checkReadWriteVLQ('C0 00'));
  assert(checkReadWriteVLQ('FF 7F'));
  assert(checkReadWriteVLQ('81 80 00'));
  assert(checkReadWriteVLQ('FF FF 7F'));
  assert(checkReadWriteVLQ('81 80 80 00'));
  assert(checkReadWriteVLQ('C0 80 80 00'));
  assert(checkReadWriteVLQ('FF FF FF 7F'));
});
