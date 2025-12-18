import { test, expect } from 'vitest';
import { TurboFrame } from './frame.js';
import { Bytes } from '../../../../bytes';
import { Readable, Unknown, Writable } from '../../../../binary/mod';

test('turbo frame', async () => {
  const frame = TurboFrame.createOrThrow({
    padding: false,
    fragment: new Unknown(Bytes.random(130)),
  });
  const bytes = Writable.writeToBytesOrThrow(frame);
  const frame2 = Readable.readFromBytesOrThrow(TurboFrame, bytes);

  expect(Bytes.equals2(frame.fragment.bytes, frame2.fragment.bytes)).toBe(true);
});
