import { Writable } from '../../../../binary/mod';
import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor/mod';
import { test, expect } from 'vitest';
import { Null } from './null';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Bytes.fromHexAllowMissing0(hex2);
  return new Cursor(buffer);
}

function checkReadWrite(_hex: string) {
  const input = hexToCursor('05 00');
  const triplet = Null.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Bytes.equals(input.bytes, output);
}

test('Read then write', async () => {
  expect(checkReadWrite('05 00')).toBe(true);
});
