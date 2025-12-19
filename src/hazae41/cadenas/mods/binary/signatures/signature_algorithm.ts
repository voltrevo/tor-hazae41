import { Cursor } from '../../../../cursor';

export class SignatureAlgorithm {
  static readonly types = {
    anonymous: 0,
    rsa: 1,
    dsa: 2,
    ecdsa: 3,
    ed25519: 7,
    ed448: 8,
  } as const;

  static readonly instances = {
    anonymous: new SignatureAlgorithm(SignatureAlgorithm.types.anonymous),
    rsa: new SignatureAlgorithm(SignatureAlgorithm.types.rsa),
    dsa: new SignatureAlgorithm(SignatureAlgorithm.types.dsa),
    ecdsa: new SignatureAlgorithm(SignatureAlgorithm.types.ecdsa),
    ed25519: new SignatureAlgorithm(SignatureAlgorithm.types.ed25519),
    ed448: new SignatureAlgorithm(SignatureAlgorithm.types.ed448),
  } as const;

  constructor(readonly type: number) {}

  static new(type: number) {
    return new SignatureAlgorithm(type);
  }

  sizeOrThrow() {
    return 1;
  }

  writeOrThrow(cursor: Cursor) {
    return cursor.writeUint8OrThrow(this.type);
  }

  static readOrThrow(cursor: Cursor) {
    return new SignatureAlgorithm(cursor.readUint8OrThrow());
  }
}
