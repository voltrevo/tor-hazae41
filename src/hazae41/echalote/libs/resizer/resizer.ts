import { assert } from '../../../../utils/assert.js';
import { Bytes } from '../../../bytes/index.js';
import { Cursor } from '../../../cursor/mod.js';
import { Writable } from '../../../binary/mod.js';

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

    assert(length <= this.maximum, `Maximum size exceeded`);

    if (length > this.inner.length) {
      const resized = new Cursor(Bytes.alloc(length));
      resized.writeOrThrow(this.inner.before);
      this.inner = resized;
    }

    this.inner.writeOrThrow(chunk);
  }

  writeFromOrThrow(writable: Writable) {
    const length = this.inner.offset + writable.sizeOrThrow();

    assert(length <= this.maximum, `Maximum size exceeded`);

    if (length > this.inner.length) {
      const resized = new Cursor(Bytes.alloc(length));
      resized.writeOrThrow(this.inner.before);
      this.inner = resized;
    }

    writable.writeOrThrow(this.inner);
  }
}
