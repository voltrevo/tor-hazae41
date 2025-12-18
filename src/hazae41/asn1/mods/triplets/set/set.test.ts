import { Writable } from '../../../../binary/mod';
import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor/mod';
import { test, expect } from 'vitest';
import { DER } from '../../resolvers/der';
import { Set } from './set';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Bytes.fromHexAllowMissing0(hex2);
  return new Cursor(buffer);
}

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const triplet = DER.readOrThrow(input);

  expect(triplet instanceof Set).toBe(true);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Bytes.equals(input.bytes, output);
}

test('Read then write', async () => {
  expect(
    checkReadWrite(
      '31 18 30 16 06 03 55 04 03 13 0F 6C 65 74 73 65 6E 63 72 79 70 74 2E 6F 72 67'
    )
  ).toBe(true);
});
