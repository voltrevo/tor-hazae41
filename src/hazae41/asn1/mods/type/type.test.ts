import { Bytes } from '../../../bytes';
import { Cursor } from '../../../cursor/mod';
import { test, expect } from 'vitest';
import { Sequence } from '../triplets/sequence/sequence';
import { Type } from './type';

function hexToType(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Bytes.fromHexAllowMissing0(hex2);
  return Type.DER.readOrThrow(new Cursor(buffer));
}

test('Read', async () => {
  expect(hexToType('30').equals(Sequence.DER.type)).toBe(true);
});
