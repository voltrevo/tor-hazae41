import { Cursor } from "../../../cursor/mod.ts";

export class Length {

  constructor(
    readonly value: number
  ) { }

  toDER() {
    return Length.DER.from(this)
  }

}

export namespace Length {

  export type DER =
    | DER.Short
    | DER.Long

  export namespace DER {

    export function from(length: Length): DER {
      if (length.value < 128)
        return new Short(length.value)

      let floor = length.value

      const values = new Array<number>()

      do {
        values.push(floor % 256)
        floor = Math.floor(floor / 256)
      } while (floor)

      values.reverse()

      return new Long(length.value, values)
    }

    export function readOrThrow(cursor: Cursor) {
      const first = cursor.readUint8OrThrow()

      if (first < 128)
        return new Short(first)

      let count = first

      /**
       * Disable the first BE bit
       */
      count &= ~(1 << (8 - 0 - 1))

      let value = 0

      const values = new Array<number>()

      for (let i = 0; i < count; i++) {
        const byte = cursor.readUint8OrThrow()
        value = (value * 256) + byte
        values.push(byte)
      }

      return new Long(value, values)
    }

    export class Short extends Length {

      constructor(
        readonly value: number
      ) {
        super(value)
      }

      sizeOrThrow() {
        return 1
      }

      writeOrThrow(cursor: Cursor) {
        cursor.writeUint8OrThrow(this.value)
      }

    }

    export class Long extends Length {

      constructor(
        readonly value: number,
        readonly values: Array<number>
      ) {
        super(value)
      }

      sizeOrThrow() {
        return 1 + this.values.length
      }

      writeOrThrow(cursor: Cursor) {
        let count = this.values.length

        /**
         * Enable the first BE bit
         */
        count |= 1 << (8 - 0 - 1)

        cursor.writeUint8OrThrow(count)

        for (const byte of this.values)
          cursor.writeUint8OrThrow(byte)

        return
      }

    }

  }

}
