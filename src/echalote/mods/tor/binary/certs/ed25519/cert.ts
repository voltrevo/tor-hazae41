import { Ed25519 } from '../../../../../../TorClient/WebCryptoEd25519.js';
import { SignedWithEd25519Key } from './extensions/signer';
import { ExpiredCertError, InvalidSignatureError } from '../../../certs/certs';
import { Bytes } from '../../../../../../hazae41/bytes/index.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';

export interface Extensions {
  signer?: SignedWithEd25519Key;
}

export class UnknownCertExtensionError extends Error {
  readonly #class = UnknownCertExtensionError;
  readonly name = this.constructor.name;

  constructor(readonly type: number) {
    super(`Unknown certificate extension ${type}`);
  }
}

export class Ed25519Cert {
  static readonly types = {
    ED_TO_SIGN: 4,
    SIGN_TO_TLS: 5,
    SIGN_TO_AUTH: 6,
  } as const;

  static readonly flags = {
    AFFECTS_VALIDATION: 1,
  } as const;

  constructor(
    readonly type: number,
    readonly version: number,
    readonly certType: number,
    readonly expiration: Date,
    readonly certKeyType: number,
    readonly certKey: Bytes<32>,
    readonly extensions: Extensions,
    readonly payload: Bytes,
    readonly signature: Bytes<64>
  ) {}

  async verifyOrThrow() {
    const now = new Date();

    if (now > this.expiration) throw new ExpiredCertError();

    if (!this.extensions.signer) return true; // TODO maybe do additionnal check?

    const signer = await Ed25519.VerifyingKey.import(
      this.extensions.signer.key
    );
    const signature = Ed25519.Signature.import(this.signature);

    const verified = await signer.verify(this.payload, signature);

    if (verified !== true) throw new InvalidSignatureError();

    return true;
  }

  static readOrThrow(cursor: Cursor) {
    const type = cursor.readUint8OrThrow();
    const _length = cursor.readUint16OrThrow(); // TODO check length

    const start = cursor.offset;

    const version = cursor.readUint8OrThrow();
    const certType = cursor.readUint8OrThrow();

    const expDateHours = cursor.readUint32OrThrow();
    const expiration = new Date(expDateHours * 60 * 60 * 1000);

    const certKeyType = cursor.readUint8OrThrow();
    const certKey = cursor.readAndCopyOrThrow(32);

    const nextensions = cursor.readUint8OrThrow();
    const extensions: Extensions = {};

    for (let i = 0; i < nextensions; i++) {
      const length = cursor.readUint16OrThrow();
      const type = cursor.readUint8OrThrow();
      const flags = cursor.readUint8OrThrow();

      if (type === SignedWithEd25519Key.type) {
        extensions.signer = SignedWithEd25519Key.readOrThrow(cursor);
        continue;
      }

      if (flags === this.flags.AFFECTS_VALIDATION)
        throw new UnknownCertExtensionError(type);

      cursor.readOrThrow(length);
    }

    const content = cursor.offset - start;

    cursor.offset = start;

    const payload = cursor.readAndCopyOrThrow(content);
    const signature = cursor.readAndCopyOrThrow(64);

    return new Ed25519Cert(
      type,
      version,
      certType,
      expiration,
      certKeyType,
      certKey,
      extensions,
      payload,
      signature
    );
  }
}
