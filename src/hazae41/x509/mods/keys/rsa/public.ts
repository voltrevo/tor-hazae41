import { DERCursor, DERTriplet, Integer, Sequence } from '../../../../asn1';
import { OIDs } from '../../oids/oids';

export interface RsaPublicKeyJSON {
  readonly publicExponent: string;
  readonly modulus: string;
}

export class RsaPublicKey {
  static oid = OIDs.keys.rsaEncryption;

  constructor(
    readonly publicExponent: Integer,
    readonly modulus: Integer
  ) {}

  toDER(): DERTriplet {
    return Sequence.DER.create(undefined, [
      this.publicExponent,
      this.modulus,
    ] as const).toDER();
  }

  toJSON(): RsaPublicKeyJSON {
    const publicExponent = this.publicExponent.value.toString(16);
    const modulus = this.modulus.value.toString(16);

    return { publicExponent, modulus };
  }

  static fromJSON(json: RsaPublicKeyJSON) {
    const publicExponent = Integer.create(
      undefined,
      BigInt('0x' + json.publicExponent)
    );
    const modulus = Integer.create(undefined, BigInt('0x' + json.modulus));

    return new this(publicExponent, modulus);
  }

  static resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsOrThrow(Sequence.DER);
    const publicExponent = cursor.readAsOrThrow(Integer.DER);
    const modulus = cursor.readAsOrThrow(Integer.DER);

    return new RsaPublicKey(publicExponent, modulus);
  }
}
