import { Bytes } from '../../../bytes';
import { Cursor } from '../../../cursor/mod';

export class Random {
  constructor(
    readonly gmt_unix_time: number,
    readonly random_bytes: Bytes<28>
  ) {}

  static default() {
    const gmt_unix_time = ~~(Date.now() / 1000);
    const random_bytes = Bytes.random(28);

    return new this(gmt_unix_time, random_bytes);
  }

  sizeOrThrow() {
    return 4 + this.random_bytes.length;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint32OrThrow(this.gmt_unix_time);
    cursor.writeOrThrow(this.random_bytes);
  }

  static readOrThrow(cursor: Cursor) {
    const gmt_unix_time = cursor.readUint32OrThrow();
    const random_bytes = cursor.readAndCopyOrThrow(28);

    return new Random(gmt_unix_time, random_bytes);
  }
}
