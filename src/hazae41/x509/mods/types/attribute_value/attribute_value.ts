import { DER, DERTriplet, DERable } from '../../../../asn1/index';
import { Base16 } from '../../../../base16/index';
import { Readable, Writable } from '../../../../binary/mod';
import { InvalidFormatError } from '../../errors';
import { DirectoryString } from '../directory_string/directory_string';

function escape(match: string) {
  const bytes = Bytes.fromUtf8(match);
  const hex = Base16.encodeOrThrow(bytes);
  return hex.replaceAll(/../g, m => '\\' + m);
}

function unescape(match: string) {
  const hex = match.replaceAll('\\', '');

  const decoded = Base16.padStartAndDecodeOrThrow(hex);

  return new TextDecoder().decode(decoded);
}

export interface StringCreator<T extends DERTriplet> {
  create(type: undefined, value: string): DERable<T>;
}

export class KnownAttributeValue {
  constructor(readonly inner: DirectoryString) {}

  toDER(): DERTriplet {
    return this.inner.inner;
  }

  static fromASN1(inner: DirectoryString.Inner) {
    return new KnownAttributeValue(DirectoryString.fromASN1(inner));
  }

  toX501() {
    let x501 = this.inner.inner.value
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"')
      .replaceAll('#', '\\#')
      .replaceAll('+', '\\+')
      .replaceAll(',', '\\,')
      .replaceAll(';', '\\;')
      .replaceAll('<', '\\<')
      .replaceAll('=', '\\=')
      .replaceAll('>', '\\>')
      .replaceAll(/[\p{Cc}\p{Cn}\p{Cs}]+/gu, escape);

    if (x501.startsWith(' ')) x501 = '\\ ' + x501.slice(1);

    if (x501.endsWith(' ')) x501 = x501.slice(0, -1) + '\\ ';

    return x501;
  }

  static fromX501<T extends DirectoryString.Inner>(
    x501: string,
    creator: StringCreator<T>
  ) {
    const value = x501
      .replaceAll('\\ ', ' ')
      .replaceAll('\\"', '"')
      .replaceAll('\\#', '#')
      .replaceAll('\\+', '+')
      .replaceAll('\\,', ',')
      .replaceAll('\\;', ';')
      .replaceAll('\\<', '<')
      .replaceAll('\\=', '=')
      .replaceAll('\\>', '>')
      .replaceAll('\\\\', '\\')
      .replaceAll(/(\\[0-9A-Fa-f]{2})+/g, unescape);

    const inner = creator.create(undefined, value).toDER();
    const string = new DirectoryString(inner);

    return new KnownAttributeValue(string);
  }
}

export class UnknownAttributeValue<T extends DERTriplet = DERTriplet> {
  constructor(readonly inner: T) {}

  toDER(): DERTriplet {
    return this.inner;
  }

  static fromASN1<T extends DERTriplet>(inner: T) {
    return new this(inner);
  }

  toX501OrThrow() {
    const bytes = Writable.writeToBytesOrThrow(this.inner);
    const hex = Base16.encodeOrThrow(bytes);

    return `#${hex}`;
  }

  static fromX501OrThrow(hex: string) {
    if (!hex.startsWith('#'))
      throw new InvalidFormatError(`AttributeValue not preceded by hash`);

    const decoded = Base16.padStartAndDecodeOrThrow(hex.slice(1));
    const triplet = Readable.readFromBytesOrThrow(DER, decoded);

    return new UnknownAttributeValue(triplet);
  }
}

export type AttributeValue = KnownAttributeValue | UnknownAttributeValue;

export namespace AttributeValue {}
