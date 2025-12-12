/**
 * X25519 Key Exchange Implementation
 *
 * Pure TypeScript implementation using @noble/curves
 * Fully compatible with the @hazae41/x25519 interface
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { getRandomValues } from 'crypto';

export interface IExportable<T> {
  readonly bytes: T;
  readonly [Symbol.dispose]: () => void;
}

export interface IPrivateKey {
  readonly [Symbol.dispose]: () => void;
  getPublicKeyOrThrow(): IPublicKey;
  computeOrThrow(publicKey: IPublicKey): Promise<ISharedSecret>;
}

export interface IPublicKey {
  readonly [Symbol.dispose]: () => void;
  exportOrThrow(): IExportable<Uint8Array>;
}

export interface ISharedSecret {
  readonly [Symbol.dispose]: () => void;
  exportOrThrow(): IExportable<Uint8Array>;
}

class PrivateKey implements IPrivateKey {
  constructor(private keyBytes: Uint8Array) {}

  getPublicKeyOrThrow(): IPublicKey {
    // Use @noble/curves to derive public key from private key
    const publicKeyBytes = x25519.getPublicKey(this.keyBytes);
    return new PublicKey(new Uint8Array(publicKeyBytes));
  }

  async computeOrThrow(publicKey: IPublicKey): Promise<ISharedSecret> {
    // Extract the public key bytes from the exported data
    const exported = await publicKey.exportOrThrow();
    const publicKeyBytes = exported.bytes;
    // Use @noble/curves to compute shared secret
    const sharedSecret = x25519.getSharedSecret(this.keyBytes, publicKeyBytes);
    return new SharedSecret(new Uint8Array(sharedSecret));
  }

  [Symbol.dispose]() {
    // Clear the key material from memory
    this.keyBytes.fill(0);
  }
}

class PublicKey implements IPublicKey {
  constructor(private keyBytes: Uint8Array) {}

  exportOrThrow(): IExportable<Uint8Array> {
    return {
      bytes: new Uint8Array(this.keyBytes),
      [Symbol.dispose]: () => {
        // Public keys don't need special cleanup
      },
    };
  }

  [Symbol.dispose]() {
    // Public keys don't need special cleanup
  }
}

class SharedSecret implements ISharedSecret {
  constructor(private keyBytes: Uint8Array) {}

  exportOrThrow(): IExportable<Uint8Array> {
    return {
      bytes: new Uint8Array(this.keyBytes),
      [Symbol.dispose]: () => {
        // Clear the shared secret from memory
        this.keyBytes.fill(0);
      },
    };
  }

  [Symbol.dispose]() {
    // Clear the shared secret from memory
    this.keyBytes.fill(0);
  }
}

/**
 * X25519 namespace providing static methods for key operations
 * This is the primary export that replaces @hazae41/x25519
 */
export const X25519 = {
  PrivateKey: {
    randomOrThrow: async (): Promise<IPrivateKey> => {
      // Generate 32 random bytes for private key
      const privateKeyBytes = new Uint8Array(32);
      getRandomValues(privateKeyBytes);
      return new PrivateKey(privateKeyBytes);
    },

    importOrThrow: async (bytes: Uint8Array): Promise<IPrivateKey> => {
      if (bytes.length !== 32) {
        throw new Error('Invalid private key length');
      }
      return new PrivateKey(new Uint8Array(bytes));
    },
  },

  PublicKey: {
    importOrThrow: async (bytes: Uint8Array): Promise<IPublicKey> => {
      if (bytes.length !== 32) {
        throw new Error('Invalid public key length');
      }
      return new PublicKey(new Uint8Array(bytes));
    },
  },
};
