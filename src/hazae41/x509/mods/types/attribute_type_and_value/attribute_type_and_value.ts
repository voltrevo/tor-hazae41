import {
  DERCursor,
  DERTriplet,
  ObjectIdentifier,
  Sequence,
  UTF8String,
} from '../../../../asn1/index.ts';
import {
  AttributeType,
  KnownAttributeType,
  UnknownAttributeType,
} from '../attribute_type/attribute_type.ts';
import {
  KnownAttributeValue,
  UnknownAttributeValue,
} from '../attribute_value/attribute_value.ts';
import { DirectoryString } from '../directory_string/directory_string.ts';

export class KnownAttributeTypeAndValue {
  constructor(
    readonly type: KnownAttributeType,
    readonly value: KnownAttributeValue
  ) {}

  isKnown(): this is KnownAttributeTypeAndValue {
    return true;
  }

  toX501OrThrow() {
    const type = this.type.toX501();
    const value = this.value.toX501();

    return `${type}=${value}`;
  }

  toDER(): DERTriplet {
    return Sequence.create(undefined, [
      this.type.inner,
      this.value.inner.toDER(),
    ] as const).toDER();
  }
}

export class UnknownAttributeTypeAndValue<T extends DERTriplet = DERTriplet> {
  constructor(
    readonly type: UnknownAttributeType,
    readonly value: UnknownAttributeValue<T>
  ) {}

  isKnown(): false {
    return false;
  }

  toX501OrThrow() {
    const type = this.type.toX501();
    const value = this.value.toX501OrThrow();

    return `${type}=${value}`;
  }

  toDER(): Sequence.DER<readonly [ObjectIdentifier.DER, DERTriplet]> {
    return Sequence.create(undefined, [
      this.type.inner,
      this.value.inner,
    ] as const).toDER();
  }
}

export type AttributeTypeAndValue =
  | KnownAttributeTypeAndValue
  | UnknownAttributeTypeAndValue;

export namespace AttributeTypeAndValue {
  export function fromASN1(
    triplet: Sequence<readonly [ObjectIdentifier.DER, DirectoryString.Inner]>
  ) {
    const [type, value] = triplet.triplets;

    const type2 = AttributeType.fromASN1(type);

    if (type2.isKnown()) {
      const value2 = KnownAttributeValue.fromASN1(value);
      return new KnownAttributeTypeAndValue(type2, value2);
    }

    const value2 = UnknownAttributeValue.fromASN1(value);
    return new UnknownAttributeTypeAndValue(type2, value2);
  }

  export function resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsOrThrow(Sequence.DER);

    const oid = cursor.readAsOrThrow(ObjectIdentifier.DER);
    const type = AttributeType.fromASN1(oid);

    if (type.isKnown()) {
      const string = DirectoryString.resolveOrThrow(cursor);
      const value = new KnownAttributeValue(string);

      return new KnownAttributeTypeAndValue(type, value);
    }

    const inner = cursor.readOrThrow();
    const value = new UnknownAttributeValue(inner);

    return new UnknownAttributeTypeAndValue(type, value);
  }

  export function fromX501OrThrow(x501: string) {
    const [rawType, rawValue] = x501.split('=');

    const type = AttributeType.fromX501OrThrow(rawType);

    if (type.isKnown()) {
      const value = KnownAttributeValue.fromX501(rawValue, UTF8String);
      return new KnownAttributeTypeAndValue(type, value);
    }

    const value = UnknownAttributeValue.fromX501OrThrow(rawValue);
    return new UnknownAttributeTypeAndValue(type, value);
  }
}
