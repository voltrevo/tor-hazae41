import { Writable } from '../../../../binary/mod';
import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor/mod';
import { test, expect } from 'vitest';
import { GeneralizedTime } from './generalized_time';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Bytes.fromHexAllowMissing0(hex2);
  return new Cursor(buffer);
}

function hexToDate(hex: string) {
  const input = hexToCursor(hex);
  return GeneralizedTime.DER.readOrThrow(input).value.toUTCString();
}

function reformatDate(text: string) {
  const date = new Date(text);
  return date.toUTCString();
}

test('Read', async () => {
  expect(
    hexToDate('18 0f 31 39 39 31 30 35 30 36 32 33 34 35 34 30 5a') ===
      reformatDate('1991-05-06 23:45:40 UTC')
  ).toBe(true);
});

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const triplet = GeneralizedTime.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Bytes.equals(input.bytes, output);
}

test('Read then write', async () => {
  expect(
    checkReadWrite('18 0f 31 39 39 31 30 35 30 36 32 33 34 35 34 30 5a')
  ).toBe(true);
});
