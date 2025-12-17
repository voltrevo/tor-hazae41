import { Cursor } from '@hazae41/cursor';
import { Bytes } from '../../../hazae41/bytes';

export class WebSocketClose {
  constructor(
    readonly code: number,
    readonly reason?: Bytes
  ) {}

  static from(code: number, reason?: string) {
    return new WebSocketClose(
      code,
      reason == null ? undefined : Bytes.fromUtf8(reason)
    );
  }

  sizeOrThrow() {
    return 2 + (this.reason == null ? 0 : this.reason.length);
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint16OrThrow(this.code);

    if (this.reason == null) return;
    cursor.writeOrThrow(this.reason);
  }

  static readOrThrow(cursor: Cursor) {
    const code = cursor.readUint16OrThrow();

    if (cursor.remaining) {
      const bytes = cursor.readOrThrow(cursor.remaining);
      const reason = Bytes.toUtf8(bytes);
      return WebSocketClose.from(code, reason);
    }

    return WebSocketClose.from(code);
  }
}
