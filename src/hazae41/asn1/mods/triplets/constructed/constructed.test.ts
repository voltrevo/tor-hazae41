import { Writable } from '../../../../binary/mod';
import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor/mod';
import { test, expect } from 'vitest';
import { Constructed } from './constructed';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Bytes.fromHexAllowMissing0(hex2);
  return new Cursor(buffer);
}

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const triplet = Constructed.DER.readOrThrow(input);

  expect(triplet instanceof Constructed).toBe(true);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Bytes.equals(input.bytes, output);
}

test('Read then write', async () => {
  expect(checkReadWrite('A0 03 02 01 02')).toBe(true);
});
