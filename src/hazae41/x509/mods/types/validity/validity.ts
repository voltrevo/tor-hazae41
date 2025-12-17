import { DERCursor, DERTriplet, GeneralizedTime, Sequence, UTCTime } from "../../../../asn1/index.ts";

export type Time =
  | UTCTime.DER
  | GeneralizedTime.DER

export interface ValidityJSON {
  notBefore: string,
  notAfter: string
}

export class Validity {

  constructor(
    readonly notBefore: Time,
    readonly notAfter: Time
  ) { }

  static generate(days: number) {
    const notBefore = new Date()
    const notAfter = new Date()

    notAfter.setDate(notAfter.getDate() + days)

    const notBefore2 = GeneralizedTime.create(undefined, notBefore).toDER()
    const notAfter2 = GeneralizedTime.create(undefined, notAfter).toDER()

    return new this(notBefore2, notAfter2)
  }

  toDER(): DERTriplet {
    return Sequence.create(undefined, [
      this.notBefore,
      this.notAfter
    ] as const).toDER()
  }

  toJSON() {
    const notBefore = this.notBefore.value.toJSON()
    const notAfter = this.notAfter.value.toJSON()

    return { notBefore, notAfter }
  }

  static fromJSON(json: ValidityJSON) {
    const notBefore = GeneralizedTime.create(undefined, new Date(json.notBefore)).toDER()
    const notAfter = GeneralizedTime.create(undefined, new Date(json.notAfter)).toDER()

    return new Validity(notBefore, notAfter)
  }

  static resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsOrThrow(Sequence.DER)

    const notBefore = (() => {
      const utc = cursor.readAs(UTCTime.DER)

      if (utc != null)
        return utc

      const gen = cursor.readAs(GeneralizedTime.DER)

      if (gen != null)
        return gen

      throw new Error(`Expected UTCTime or GeneralizedTime`)
    })()

    const notAfter = (() => {
      const utc = cursor.readAs(UTCTime.DER)

      if (utc != null)
        return utc

      const gen = cursor.readAs(GeneralizedTime.DER)

      if (gen != null)
        return gen

      throw new Error(`Expected UTCTime or GeneralizedTime`)
    })()

    return new Validity(notBefore, notAfter)
  }

}