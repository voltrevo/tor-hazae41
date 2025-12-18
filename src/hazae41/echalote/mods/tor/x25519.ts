/**
 * X25519 Key Exchange Implementation
 *
 * Pure TypeScript implementation using @noble/curves
 * Fully compatible with the @hazae41/x25519 interface
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { Bytes } from '../../../bytes';

export interface IExportable<T> {
  readonly bytes: T;
}

export interface IPrivateKey {
  getPublicKeyOrThrow(): IPublicKey;
  computeOrThrow(publicKey: IPublicKey): Promise<ISharedSecret>;
}

export interface IPublicKey {
  exportOrThrow(): IExportable<Bytes>;
}

export interface ISharedSecret {
  exportOrThrow(): IExportable<Bytes>;
}

class PrivateKey implements IPrivateKey {
  constructor(private keyBytes: Bytes) {}

  getPublicKeyOrThrow(): IPublicKey {
    // Use @noble/curves to derive public key from private key
    const publicKeyBytes = x25519.getPublicKey(this.keyBytes);
    return new PublicKey(Bytes.from(publicKeyBytes));
  }

  async computeOrThrow(publicKey: IPublicKey): Promise<ISharedSecret> {
    // Extract the public key bytes from the exported data
    const exported = await publicKey.exportOrThrow();
    const publicKeyBytes = exported.bytes;
    // Use @noble/curves to compute shared secret
    const sharedSecret = x25519.getSharedSecret(this.keyBytes, publicKeyBytes);
    return new SharedSecret(Bytes.from(sharedSecret));
  }
}

class PublicKey implements IPublicKey {
  constructor(private keyBytes: Bytes) {}

  exportOrThrow(): IExportable<Bytes> {
    return {
      bytes: Bytes.from(this.keyBytes),
    };
  }
}

class SharedSecret implements ISharedSecret {
  constructor(private keyBytes: Bytes) {}

  exportOrThrow(): IExportable<Bytes> {
    return {
      bytes: Bytes.from(this.keyBytes),
    };
  }
}

/**
 * X25519 namespace providing static methods for key operations
 * This is the primary export that replaces @hazae41/x25519
 */
export const X25519 = {
  PrivateKey: {
    randomOrThrow: async (): Promise<IPrivateKey> => {
      // Generate 32 random bytes for private key using browser-compatible random
      const privateKeyBytes = Bytes.random(32);
      return new PrivateKey(Bytes.from(privateKeyBytes));
    },

    importOrThrow: async (bytes: Bytes): Promise<IPrivateKey> => {
      if (bytes.length !== 32) {
        throw new Error('Invalid private key length');
      }
      return new PrivateKey(Bytes.from(bytes));
    },
  },

  PublicKey: {
    importOrThrow: async (bytes: Bytes): Promise<IPublicKey> => {
      if (bytes.length !== 32) {
        throw new Error('Invalid public key length');
      }
      return new PublicKey(Bytes.from(bytes));
    },
  },
};
