import { HASH_LEN, KEY_LEN } from '../constants';
import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor';

export class InvalidKdfKeyHashError extends Error {
  readonly #class = InvalidKdfKeyHashError;
  readonly name = this.constructor.name;

  constructor() {
    super(`Invalid KDF key hash`);
  }
}

export interface KDFTorResult {
  readonly keyHash: Bytes<HASH_LEN>;
  readonly forwardDigest: Bytes<HASH_LEN>;
  readonly backwardDigest: Bytes<HASH_LEN>;
  readonly forwardKey: Bytes<KEY_LEN>;
  readonly backwardKey: Bytes<KEY_LEN>;
}

export namespace KDFTorResult {
  export async function computeOrThrow(k0: Bytes): Promise<KDFTorResult> {
    const ki = new Cursor(Bytes.alloc(k0.length + 1));
    ki.writeOrThrow(k0);

    const k = new Cursor(Bytes.alloc(HASH_LEN * 5));

    for (let i = 0; k.remaining > 0; i++) {
      ki.setUint8OrThrow(i);

      const h = Bytes.from(await crypto.subtle.digest('SHA-1', ki.bytes));

      k.writeOrThrow(h);
    }

    k.offset = 0;

    const keyHash = k.readAndCopyOrThrow(HASH_LEN);
    const forwardDigest = k.readAndCopyOrThrow(HASH_LEN);
    const backwardDigest = k.readAndCopyOrThrow(HASH_LEN);
    const forwardKey = k.readAndCopyOrThrow(KEY_LEN);
    const backwardKey = k.readAndCopyOrThrow(KEY_LEN);

    return { keyHash, forwardDigest, backwardDigest, forwardKey, backwardKey };
  }
}
