import { Cursor } from '../../../cursor/mod.ts';
import { Unimplemented } from '../errors/errors.ts';

export class Type {
  static clazzes = {
    UNIVERSAL: 0,
    APPLICATION: 1,
    CONTEXT: 2,
    PRIVATE: 3,
  } as const;

  static wraps = {
    PRIMITIVE: 0,
    CONSTRUCTED: 1,
  } as const;

  static tags = {
    BOOLEAN: 1,
    INTEGER: 2,
    BIT_STRING: 3,
    OCTET_STRING: 4,
    NULL: 5,
    OBJECT_IDENTIFIER: 6,
    UTF8_STRING: 12,
    SEQUENCE: 16,
    SET: 17,
    NUMERIC_STRING: 18,
    PRINTABLE_STRING: 19,
    TELETEX_STRING: 20,
    VIDEO_TEX_STRING: 21,
    IA5_STRING: 22,
    UTC_TIME: 23,
    GENERALIZED_TIME: 24,
  } as const;

  constructor(
    readonly clazz: number,
    readonly wrap: number,
    readonly tag: number
  ) {}

  static create(clazz: number, wrap: number, tag: number) {
    return new Type(clazz, wrap, tag);
  }

  static context(constructed: boolean, tag: number) {
    const wrap = constructed ? Type.wraps.CONSTRUCTED : Type.wraps.PRIMITIVE;

    return new Type(Type.clazzes.CONTEXT, wrap, tag);
  }

  static application(constructed: boolean, tag: number) {
    const wrap = constructed ? Type.wraps.CONSTRUCTED : Type.wraps.PRIMITIVE;

    return new Type(Type.clazzes.APPLICATION, wrap, tag);
  }

  static private(constructed: boolean, tag: number) {
    const wrap = constructed ? Type.wraps.CONSTRUCTED : Type.wraps.PRIMITIVE;

    return new Type(Type.clazzes.PRIVATE, wrap, tag);
  }

  toDER() {
    return Type.DER.from(this);
  }
}

export namespace Type {
  export class DER extends Type {
    static readonly size = 1;

    constructor(
      readonly byte: number,
      readonly clazz: number,
      readonly wrap: number,
      readonly tag: number
    ) {
      super(clazz, wrap, tag);
    }

    static from(type: Type) {
      let byte = 0;
      byte |= type.clazz << 6;
      byte |= type.wrap << 5;
      byte |= type.tag;

      return new DER(byte, type.clazz, type.wrap, type.tag);
    }

    equals(other: DER) {
      return this.byte === other.byte;
    }

    static context(constructed: boolean, tag: number) {
      return super.context(constructed, tag).toDER();
    }

    static application(constructed: boolean, tag: number) {
      return super.application(constructed, tag).toDER();
    }

    static private(constructed: boolean, tag: number) {
      return super.private(constructed, tag).toDER();
    }

    sizeOrThrow() {
      return 1;
    }

    writeOrThrow(cursor: Cursor) {
      cursor.writeUint8OrThrow(this.byte);
    }

    static readOrThrow(cursor: Cursor) {
      const byte = cursor.readUint8OrThrow();

      const clazz = byte >> 6;
      const wrap = (byte >> 5) & 1;
      const tag = byte & 0b11111;

      if (tag > 30)
        // TODO
        throw new Unimplemented();

      return new DER(byte, clazz, wrap, tag);
    }
  }
}
