import type { Cursor } from '../cursor/mod';
import { Bytes } from '../bytes';
import { Readable } from './readable';
import { Writable } from './writable';

export class Unknown<N extends number = number> {
  constructor(readonly bytes: Bytes<N>) {}

  sizeOrThrow(): N {
    return this.bytes.length;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.bytes);
  }

  cloneOrThrow(): Unknown<N> {
    return new Unknown(Bytes.from(this.bytes));
  }

  readIntoOrThrow<T extends Readable.Infer<T>>(
    readable: T
  ): Readable.Output<T> {
    return Readable.readFromBytesOrThrow(readable, this.bytes);
  }
}

export namespace Unknown {
  export function readOrThrow(cursor: Cursor): Unknown {
    return new Unknown(cursor.readOrThrow(cursor.remaining));
  }

  export function writeFromOrThrow(writable: Writable): Unknown {
    if (writable instanceof Unknown) return writable;
    return new Unknown(Writable.writeToBytesOrThrow(writable));
  }
}
