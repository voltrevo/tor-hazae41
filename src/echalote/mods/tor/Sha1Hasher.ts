import { createSHA1 } from 'hash-wasm';
import { Bytes } from '../../../hazae41/bytes';

interface SHA1Hasher {
  init(): void;
  update(data: Bytes | string): void;
  digest(encoding: 'hex' | 'binary'): string | Bytes;
  save(): Bytes;
  load(state: Bytes): void;
}

/**
 * Async wrapper around hash-wasm SHA1 hasher
 */
export class Sha1Hasher {
  private constructor(private readonly hasher: SHA1Hasher) {}

  static async createOrThrow(): Promise<Sha1Hasher> {
    const hasher = await createSHA1();
    hasher.init();
    return new Sha1Hasher(hasher);
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
    return new Sha1Hasher(clonedHasher);
  }
}
