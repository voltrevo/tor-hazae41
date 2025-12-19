import { Writable } from '../../../binary/mod';
import { Bytes } from '../../../bytes';
import { Cursor } from '../../../cursor';
import { test, expect } from 'vitest';
import { Length } from './length';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Bytes.fromHexAllowMissing0(hex2);
  return new Cursor(buffer);
}

function hexToLength(hex: string) {
  const cursor = hexToCursor(hex);
  const length = Length.DER.readOrThrow(cursor);
  return length.value;
}

test('Read', async () => {
  expect(hexToLength('82 01 7F') === 383).toBe(true);
  expect(hexToLength('82 04 92') === 1170).toBe(true);
});

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const length = Length.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(length);
  return Bytes.equals(input.bytes, output);
}

test('Read then write', async () => {
  expect(checkReadWrite('82 01 7F')).toBe(true);
  expect(checkReadWrite('82 04 92')).toBe(true);
});
