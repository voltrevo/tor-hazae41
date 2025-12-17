import { DERCursor, DERTriplet, Set } from "../../../../asn1/index.ts";
import { AttributeTypeAndValue } from "../attribute_type_and_value/attribute_type_and_value.ts";

const UNESCAPED_PLUS_REGEX = /[^\\]\+/g

export class RelativeDistinguishedName {

  constructor(
    readonly triplets: AttributeTypeAndValue[]
  ) { }

  toDER(): DERTriplet {
    return Set.create(undefined, this.triplets.map(it => it.toDER())).toDER()
  }

  toX501OrThrow() {
    return this.triplets.map(it => it.toX501OrThrow()).join("+")
  }

  static fromX501OrThrow(x501: string) {
    const triplets = x501
      .replaceAll(UNESCAPED_PLUS_REGEX, ([c]) => `${c}++`)
      .split("++")
      .map(it => AttributeTypeAndValue.fromX501OrThrow(it))

    return new RelativeDistinguishedName(triplets)
  }

  static resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsOrThrow(Set.DER)

    const triplets = new Array<AttributeTypeAndValue>(cursor.triplets.length)

    for (let i = 0; i < triplets.length; i++)
      triplets[i] = AttributeTypeAndValue.resolveOrThrow(cursor)

    return new RelativeDistinguishedName(triplets)
  }

}