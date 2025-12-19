import { Writable } from '../../../binary/mod';
import { Bytes } from '../../../bytes';
import { Cursor } from '../../../cursor';
import { test, expect } from 'vitest';
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
  expect(hexToVLQ('00') === 0).toBe(true);
  expect(hexToVLQ('7F') === 127).toBe(true);
  expect(hexToVLQ('81 00') === 128).toBe(true);
  expect(hexToVLQ('C0 00') === 8192).toBe(true);
  expect(hexToVLQ('FF 7F') === 16383).toBe(true);
  expect(hexToVLQ('81 80 00') === 16384).toBe(true);
  expect(hexToVLQ('FF FF 7F') === 2097151).toBe(true);
  expect(hexToVLQ('81 80 80 00') === 2097152).toBe(true);
  expect(hexToVLQ('C0 80 80 00') === 134217728).toBe(true);
  expect(hexToVLQ('FF FF FF 7F') === 268435455).toBe(true);
});

function checkReadWriteVLQ(hex: string) {
  const input = hexToCursor(hex);
  const vlq = VLQ.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(vlq);
  return Bytes.equals(input.bytes, output);
}

test('Read then write', async () => {
  expect(checkReadWriteVLQ('00')).toBe(true);
  expect(checkReadWriteVLQ('7F')).toBe(true);
  expect(checkReadWriteVLQ('81 00')).toBe(true);
  expect(checkReadWriteVLQ('C0 00')).toBe(true);
  expect(checkReadWriteVLQ('FF 7F')).toBe(true);
  expect(checkReadWriteVLQ('81 80 00')).toBe(true);
  expect(checkReadWriteVLQ('FF FF 7F')).toBe(true);
  expect(checkReadWriteVLQ('81 80 80 00')).toBe(true);
  expect(checkReadWriteVLQ('C0 80 80 00')).toBe(true);
  expect(checkReadWriteVLQ('FF FF FF 7F')).toBe(true);
});
