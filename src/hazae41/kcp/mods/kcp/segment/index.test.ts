import { Readable, Writable } from '../../../../binary/mod';
import { assert, test } from '../../../../phobos/mod';
import { relative, resolve } from 'path';
import { KcpSegment } from './index';
import { Opaque } from '../../../../asn1/mods/triplets/opaque/opaque';
import { Bytes } from '@hazae41/bytes';

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

test('kcp segment', async () => {
  const conversation = 12345;
  const command = KcpSegment.commands.push;
  const count = 0;
  const window = 65_535;
  const timestamp = Date.now() / 1000;
  const serial = 0;
  const unackSerial = 0;
  const fragment = new Opaque(crypto.getRandomValues(Bytes.alloc(130)));

  const segment = KcpSegment.newOrThrow({
    conversation,
    command,
    count,
    window,
    timestamp,
    serial,
    unackSerial,
    fragment,
  });

  const bytes = Writable.writeToBytesOrThrow(segment);
  const frame2 = Readable.readFromBytesOrThrow(KcpSegment, bytes);

  assert(Bytes.equals(segment.fragment.bytes, frame2.fragment.bytes));
});
