import { Writable } from '../../../binary/mod';
import { Bytes } from '../../../bytes';
import { Cursor } from '../../../cursor/mod';

export class Resizer {
  inner: Cursor;

  constructor(
    readonly minimum = 2 ** 10,
    readonly maximum = 2 ** 20
  ) {
    this.inner = new Cursor(Bytes.alloc(this.minimum));
  }

  writeOrThrow(chunk: Bytes) {
    const length = this.inner.offset + chunk.length;

    if (length > this.maximum) throw new Error(`Maximum size exceeded`);

    if (length > this.inner.length) {
      const resized = new Cursor(Bytes.alloc(length));
      resized.writeOrThrow(this.inner.before);
      this.inner = resized;
    }

    this.inner.writeOrThrow(chunk);
  }

  writeFromOrThrow(writable: Writable) {
    const length = this.inner.offset + writable.sizeOrThrow();

    if (length > this.maximum) throw new Error(`Maximum size exceeded`);

    if (length > this.inner.length) {
      const resized = new Cursor(Bytes.alloc(length));
      resized.writeOrThrow(this.inner.before);
      this.inner = resized;
    }

    writable.writeOrThrow(this.inner);
  }
}
