import type { Lengthed } from '../../../libs/lengthed/mod';
import { Readable } from '../../../mods/binary/readable/mod';
import { Writable } from '../../../mods/binary/writable/mod';
import type { Cursor } from '../../../../cursor/mod';

export class Unknown<
  T extends ArrayBufferLike = ArrayBufferLike,
  N extends number = number,
> {
  constructor(readonly bytes: Uint8Array<T> & Lengthed<N>) {}

  sizeOrThrow(): N {
    return this.bytes.length;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.bytes);
  }

  cloneOrThrow(): Unknown<ArrayBuffer, N> {
    return new Unknown(
      new Uint8Array(this.bytes) as Uint8Array<ArrayBuffer> & Lengthed<N>
    );
  }

  readIntoOrThrow<T extends Readable.Infer<T>>(
    readable: T
  ): Readable.Output<T> {
    return Readable.readFromBytesOrThrow(readable, this.bytes);
  }
}

export namespace Unknown {
  export function readOrThrow<T extends ArrayBufferLike>(
    cursor: Cursor<T>
  ): Unknown<T> {
    return new Unknown(cursor.readOrThrow(cursor.remaining));
  }

  export function writeFromOrThrow(writable: Writable): Unknown<ArrayBuffer> {
    if (writable instanceof Unknown) return writable;
    return new Unknown(Writable.writeToBytesOrThrow(writable));
  }
}
