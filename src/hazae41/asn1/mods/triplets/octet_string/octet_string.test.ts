import { Writable } from '../../../../binary/mod';
import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor';
import { test, expect } from 'vitest';
import { OctetString } from './octet_string';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Bytes.fromHexAllowMissing0(hex2);
  return new Cursor(buffer);
}

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const triplet = OctetString.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Bytes.equals(input.bytes, output);
}

test('Read then write', async () => {
  expect(
    checkReadWrite(
      '04 63 30 61 30 2E 06 08 2B 06 01 05 05 07 30 01 86 22 68 74 74 70 3A 2F 2F 6F 63 73 70 2E 69 6E 74 2D 78 33 2E 6C 65 74 73 65 6E 63 72 79 70 74 2E 6F 72 67 30 2F 06 08 2B 06 01 05 05 07 30 02 86 23 68 74 74 70 3A 2F 2F 63 65 72 74 2E 69 6E 74 2D 78 33 2E 6C 65 74 73 65 6E 63 72 79 70 74 2E 6F 72 67 2F'
    )
  ).toBe(true);
});
