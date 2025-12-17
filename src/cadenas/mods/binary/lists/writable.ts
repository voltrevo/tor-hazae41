import { Writable } from '../../../../hazae41/binary/mod';
import { Cursor } from '../../../../hazae41/cursor/mod';

export interface List<T extends Writable> extends Writable {
  readonly array: T[];
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class List<T extends Writable> {
  constructor(readonly array: T[]) {}

  static from<T extends Writable>(array: T[]) {
    return new this(array);
  }

  sizeOrThrow() {
    let size = 0;

    for (const element of this.array) size += element.sizeOrThrow();

    return size;
  }

  writeOrThrow(cursor: Cursor) {
    for (const element of this.array) element.writeOrThrow(cursor);
    return;
  }
}
