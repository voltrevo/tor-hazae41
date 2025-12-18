import { createSHA1, IDataType } from 'hash-wasm';
import { Bytes } from '../../../bytes';

interface SHA1Hasher {
  init(): void;
  update(data: Bytes | string): void;
  digest(encoding: 'hex' | 'binary'): string | Bytes;
  save(): Bytes;
  load(state: Bytes): void;
}

/**
 * Same as IHasher but with Uint8Array<ArrayBuffer> to be compatible with Bytes.
 * Used for type casting since we only work with local bytes.
 */
type ILocalHasher = {
  /**
   * Initializes hash state to default value
   */
  init: () => ILocalHasher;
  /**
   * Updates the hash content with the given data
   */
  update: (data: IDataType) => ILocalHasher;
  /**
   * Calculates the hash of all of the data passed to be hashed with hash.update().
   * Defaults to hexadecimal string
   * @param outputType If outputType is "binary", it returns Uint8Array. Otherwise it
   *                   returns hexadecimal string
   */
  digest: {
    (outputType: 'binary'): Uint8Array<ArrayBuffer>;
    (outputType?: 'hex'): string;
  };
  /**
   * Save the current internal state of the hasher for later resumption with load().
   * Cannot be called before .init() or after .digest()
   *
   * Note that this state can include arbitrary information about the value being hashed (e.g.
   * could include N plaintext bytes from the value), so needs to be treated as being as
   * sensitive as the input value itself.
   */
  save: () => Uint8Array<ArrayBuffer>;
  /**
   * Resume a state that was created by save(). If this state was not created by a
   * compatible build of hash-wasm, an exception will be thrown.
   */
  load: (state: Uint8Array<ArrayBuffer>) => ILocalHasher;
  /**
   * Block size in bytes
   */
  blockSize: number;
  /**
   * Digest size in bytes
   */
  digestSize: number;
};

/**
 * Async wrapper around hash-wasm SHA1 hasher
 */
export class Sha1Hasher {
  private constructor(private readonly hasher: SHA1Hasher) {}

  static async createOrThrow(): Promise<Sha1Hasher> {
    const hasher = await createSHA1();
    hasher.init();
    return new Sha1Hasher(hasher as ILocalHasher);
  }

  updateOrThrow(data: Bytes): void {
    this.hasher.update(data);
  }

  finalizeOrThrow(): Bytes<20> {
    // hash-wasm's digest() is destructive, so we save state before and restore after
    // to maintain compatibility with @hazae41/sha1's non-destructive behavior.
    // This allows Tor's circuit digest pattern where update() can be called after finalize().
    const state = this.hasher.save();
    const result = this.hasher.digest('binary') as Bytes<20>;
    this.hasher.load(state);
    return result;
  }

  async cloneOrThrow(): Promise<Sha1Hasher> {
    const clonedHasher = await createSHA1();
    clonedHasher.load(this.hasher.save());
    return new Sha1Hasher(clonedHasher as ILocalHasher);
  }
}
