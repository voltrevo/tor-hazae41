import { Base16 } from '../../../../base16/index';
import { Writable } from '../../../../binary/mod';
import { Cursor } from '../../../../cursor/mod';
import { assert, test } from '../../../../phobos/mod';
import { IA5String } from './ia5_string';

function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Base16.padStartAndDecodeOrThrow(hex2);
  return new Cursor(buffer);
}

function checkReadWrite(hex: string) {
  const input = hexToCursor(hex);
  const triplet = IA5String.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Buffer.from(input.bytes).equals(Buffer.from(output));
}

test('Read then write', async () => {
  assert(checkReadWrite('0C 0C 54 65 73 74 20 65 64 32 35 35 31 39'));
});
