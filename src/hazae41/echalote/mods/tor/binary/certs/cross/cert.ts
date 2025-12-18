import { ExpiredCertError } from '../../../certs/certs';
import { Unimplemented } from '../../../errors';
import { Bytes } from '../../../../../../bytes';
import { Cursor } from '../../../../../../cursor/mod';

export class CrossCert {
  readonly #class = CrossCert;

  static readonly types = {
    RSA_TO_ED: 7,
  } as const;

  constructor(
    readonly type: number,
    readonly key: Bytes<32>,
    readonly expiration: Date,
    readonly payload: Bytes,
    readonly signature: Bytes
  ) {}

  verifyOrThrow() {
    const now = new Date();

    if (now > this.expiration) throw new ExpiredCertError();

    return true;
  }

  sizeOrThrow(): never {
    throw new Unimplemented();
  }

  writeOrThrow(_cursor: Cursor): never {
    throw new Unimplemented();
  }

  static readOrThrow(cursor: Cursor) {
    const type = cursor.readUint8OrThrow();
    const length = cursor.readUint16OrThrow();

    const start = cursor.offset;

    const key = cursor.readAndCopyOrThrow(32);

    const expDateHours = cursor.readUint32OrThrow();
    const expiration = new Date(expDateHours * 60 * 60 * 1000);

    const content = cursor.offset - start;

    cursor.offset = start;

    const payload = cursor.readAndCopyOrThrow(content);

    const sigLength = cursor.readUint8OrThrow();
    const signature = cursor.readAndCopyOrThrow(sigLength);

    const end = cursor.offset;
    const actualLength = end - start;

    if (actualLength !== length) {
      throw new Error(
        `CrossCert length mismatch: expected ${length}, got ${actualLength}`
      );
    }

    return new CrossCert(type, key, expiration, payload, signature);
  }
}
