import { Base16 } from '../../../../base16/index';
import { Writable } from '../../../../binary/mod';
import { Cursor } from '../../../../cursor/mod';
import { assert, test } from '../../../../phobos/mod';
import { Boolean } from './boolean';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Base16.padStartAndDecodeOrThrow(hex2);
  return new Cursor(buffer);
}

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const triplet = Boolean.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Buffer.from(input.bytes).equals(Buffer.from(output));
}

test('Read then write', async () => {
  assert(checkReadWrite('01 01 00'));
  assert(checkReadWrite('01 01 01'));
  assert(checkReadWrite('01 01 FF'));
});
