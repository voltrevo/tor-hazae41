import { Cursor } from '../../../cursor';

export class VLQ {
  constructor(readonly value: number) {}

  toDER() {
    return VLQ.DER.from(this);
  }
}

export namespace VLQ {
  export class DER extends VLQ {
    constructor(
      readonly value: number,
      readonly values: Array<number>
    ) {
      super(value);
    }

    static from(vlq: VLQ) {
      let value = vlq.value;

      const values = new Array<number>();

      do {
        values.push(value % 128);
        value = Math.floor(value / 128);
      } while (value);

      values.reverse();

      return new DER(vlq.value, values);
    }

    sizeOrThrow() {
      return this.values.length;
    }

    writeOrThrow(cursor: Cursor) {
      for (let i = 0; i < this.values.length - 1; i++) {
        let byte = this.values[i];

        /**
         * Enable the first BE bit
         */
        byte |= 1 << (8 - 0 - 1);

        cursor.writeUint8OrThrow(byte);
      }

      cursor.writeUint8OrThrow(this.values[this.values.length - 1]);
    }

    static readOrThrow(cursor: Cursor) {
      let value = 0;

      const values = new Array<number>();

      while (true) {
        const byte = cursor.readUint8OrThrow();

        if (byte <= 127) {
          value = value * 128 + byte;
          values.push(byte);
          break;
        }

        let integer = byte;

        /**
         * Disable the first BE bit
         */
        integer &= ~(1 << (8 - 0 - 1));

        value = value * 128 + integer;
        values.push(integer);
      }

      return new DER(value, values);
    }
  }
}
