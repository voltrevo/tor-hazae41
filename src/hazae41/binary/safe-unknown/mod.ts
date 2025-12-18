import type { Cursor } from '../../cursor/mod';
import { Bytes } from '../../bytes';
import { Readable } from '../readable/mod';
import { Writable } from '../writable/mod';

export class SafeUnknown<N extends number = number> {
  constructor(readonly bytes: Bytes<N>) {}

  sizeOrThrow(): N {
    return this.bytes.length;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.bytes);
  }

  cloneOrThrow(): SafeUnknown<N> {
    return new SafeUnknown(Bytes.from(this.bytes));
  }

  readIntoOrThrow<T extends Readable.Infer<T>>(
    readable: T
  ): Readable.Output<T> {
    return Readable.readFromBytesOrThrow(readable, Bytes.from(this.bytes));
  }
}

export namespace SafeUnknown {
  export function readOrThrow(cursor: Cursor): SafeUnknown {
    return new SafeUnknown(Bytes.from(cursor.readOrThrow(cursor.remaining)));
  }

  export function writeFromOrThrow(writable: Writable): SafeUnknown {
    if (writable instanceof SafeUnknown) return writable.cloneOrThrow();
    return new SafeUnknown(Writable.writeToBytesOrThrow(writable));
  }
}
