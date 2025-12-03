import { Opaque, Readable, Writable } from '@hazae41/binary';
import { Bytes } from '@hazae41/bytes';
import { assert, test } from '@hazae41/phobos';
import { TurboFrame } from './frame.js';

test('turbo frame', async () => {
  const frame = TurboFrame.createOrThrow({
    padding: false,
    fragment: new Opaque(Bytes.random(130)),
  });
  const bytes = Writable.writeToBytesOrThrow(frame);
  const frame2 = Readable.readFromBytesOrThrow(TurboFrame, bytes);

  assert(Bytes.equals2(frame.fragment.bytes, frame2.fragment.bytes));
});
