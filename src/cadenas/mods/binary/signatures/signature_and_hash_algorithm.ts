import { Cursor } from '../../../../hazae41/cursor/mod.js';
import { HashAlgorithm } from '../../../mods/binary/signatures/hash_algorithm.js';
import { SignatureAlgorithm } from '../../../mods/binary/signatures/signature_algorithm.js';

export class SignatureAndHashAlgorithm {
  static readonly instances = {
    rsa_pkcs1_sha256: new this(
      HashAlgorithm.instances.sha256,
      SignatureAlgorithm.instances.rsa
    ),
    ecdsa_secp256r1_sha256: new this(
      HashAlgorithm.instances.sha256,
      SignatureAlgorithm.instances.ecdsa
    ),
    ed25519: new this(
      HashAlgorithm.instances.intrinsic,
      SignatureAlgorithm.instances.ed25519
    ),
    ed448: new this(
      HashAlgorithm.instances.intrinsic,
      SignatureAlgorithm.instances.ed448
    ),
  } as const;

  constructor(
    readonly hash: HashAlgorithm,
    readonly signature: SignatureAlgorithm
  ) {}

  sizeOrThrow() {
    return this.hash.sizeOrThrow() + this.signature.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.hash.writeOrThrow(cursor);
    this.signature.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const hash = HashAlgorithm.readOrThrow(cursor);
    const signature = SignatureAlgorithm.readOrThrow(cursor);

    return new SignatureAndHashAlgorithm(hash, signature);
  }
}
