import { Readable, Writable, Unknown } from '../../../../binary/mod';
import { test, expect } from 'vitest';
import { KcpSegment } from '.';
import { Bytes } from '../../../../bytes';

test('kcp segment', async () => {
  const conversation = 12345;
  const command = KcpSegment.commands.push;
  const count = 0;
  const window = 65_535;
  const timestamp = Date.now() / 1000;
  const serial = 0;
  const unackSerial = 0;
  const fragment = new Unknown(crypto.getRandomValues(Bytes.alloc(130)));

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

  expect(Bytes.equals(segment.fragment.bytes, frame2.fragment.bytes)).toBe(
    true
  );
});
