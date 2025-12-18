// deno-lint-ignore-file no-unused-vars require-await
import { test, expect } from 'vitest';
import { Readable } from './readable';
import { Unknown } from './Unknown';
import { Bytes } from '../bytes';

test('Opaque', async () => {
  const bytes = Bytes.from([1, 2, 3, 4, 5]);

  const opaque = Readable.readFromBytesOrThrow(Unknown, bytes);
  const opaque2 = opaque.readIntoOrThrow(Unknown).cloneOrThrow();
  const opaque3 = Unknown.writeFromOrThrow(opaque2);

  expect(Bytes.equals(opaque.bytes, opaque2.bytes)).toBe(true);
  expect(Bytes.equals(opaque2.bytes, opaque3.bytes)).toBe(true);
});
