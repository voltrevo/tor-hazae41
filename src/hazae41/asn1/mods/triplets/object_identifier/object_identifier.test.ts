import { Base16 } from '../../../../base16/index';
import { Writable } from '../../../../binary/mod';
import { Cursor } from '../../../../cursor/mod';
import { assert, test } from '../../../../phobos/mod';
import { ObjectIdentifier } from './object_identifier';


function hexToCursor(hex: string) {
  const hex2 = hex.replaceAll(' ', '');
  const buffer = Base16.padStartAndDecodeOrThrow(hex2);
  return new Cursor(buffer);
}

function checkReadWriteOID(hex: string) {
  const input = hexToCursor(hex);
  const triplet = ObjectIdentifier.DER.readOrThrow(input);

  const output = Writable.writeToBytesOrThrow(triplet);
  return Buffer.from(input.bytes).equals(Buffer.from(output));
}

test('Read then write', async () => {
  assert(checkReadWriteOID('06 09 2A 86 48 86 F7 0D 01 01 0B'));
  assert(checkReadWriteOID('06 03 55 04 0A'));
});
