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
  private disposed = false;

  constructor(private keyBytes: Bytes) {}

  getPublicKeyOrThrow(): IPublicKey {
    if (this.disposed) {
      throw new Error('PrivateKey has been disposed');
    }
    const publicKeyBytes = x25519.getPublicKey(this.keyBytes);
    return new PublicKey(Bytes.from(publicKeyBytes));
  }

  async computeOrThrow(publicKey: IPublicKey): Promise<ISharedSecret> {
    if (this.disposed) {
      throw new Error('PrivateKey has been disposed');
    }
    const exported = await publicKey.exportOrThrow();
    const publicKeyBytes = exported.bytes;
    const sharedSecretBytes = x25519.getSharedSecret(
      this.keyBytes,
      publicKeyBytes
    );
    const sharedSecretBytesCopy = Bytes.from(sharedSecretBytes);
    sharedSecretBytes.fill(0);
    return new SharedSecret(sharedSecretBytesCopy);
  }

  dispose(): void {
    if (!this.disposed) {
      Bytes.zeroize(this.keyBytes);
      this.disposed = true;
    }
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
  private disposed = false;

  constructor(private keyBytes: Bytes) {}

  exportOrThrow(): IExportable<Bytes> {
    if (this.disposed) {
      throw new Error('SharedSecret has been disposed');
    }
    return {
      bytes: Bytes.from(this.keyBytes),
    };
  }

  dispose(): void {
    if (!this.disposed) {
      Bytes.zeroize(this.keyBytes);
      this.disposed = true;
    }
  }
}

/**
 * X25519 namespace providing static methods for key operations
 * This is the primary export that replaces @hazae41/x25519
 */
export const X25519 = {
  PrivateKey: {
    randomOrThrow: async (): Promise<IPrivateKey> => {
      const privateKeyBytes = Bytes.random(32);
      const key = new PrivateKey(Bytes.from(privateKeyBytes));
      Bytes.zeroize(privateKeyBytes);
      return key;
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
