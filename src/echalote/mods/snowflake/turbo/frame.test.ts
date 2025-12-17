import { test } from '../../../../hazae41/phobos/mod';
import { assert } from '../../../../utils/assert';
import { TurboFrame } from './frame.js';
import { Bytes } from '../../../../hazae41/bytes';
import { Readable, Unknown, Writable } from '../../../../hazae41/binary/mod';

test('turbo frame', async () => {
  const frame = TurboFrame.createOrThrow({
    padding: false,
    fragment: new Unknown(Bytes.random(130)),
  });
  const bytes = Writable.writeToBytesOrThrow(frame);
  const frame2 = Readable.readFromBytesOrThrow(TurboFrame, bytes);

  assert(Bytes.equals2(frame.fragment.bytes, frame2.fragment.bytes));
});
