import { Cursor } from '@hazae41/cursor';

export class ECCurveType {
  static readonly types = {
    // deprecated: 1..2,
    named_curve: 3,
    // reserved: 248..255
  } as const;

  static readonly instances = {
    named_curve: new this(this.types.named_curve),
  } as const;

  constructor(readonly value: number) {}

  static new(value: number) {
    return new ECCurveType(value);
  }

  sizeOrThrow() {
    return 1;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.value);
  }

  static readOrThrow(cursor: Cursor) {
    return new ECCurveType(cursor.readUint8OrThrow());
  }
}
