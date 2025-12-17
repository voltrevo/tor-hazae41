/**
 * WebCrypto-based Ed25519 implementation
 * Works in Node.js 15+ and modern browsers
 * No initialization needed - stateless factories
 */

import { Bytes } from '../hazae41/bytes';

export namespace Ed25519 {
  export class Signature {
    constructor(private data: Bytes) {}

    export() {
      return {
        bytes: Bytes.from(this.data),
      };
    }

    static import(bytes: Bytes | { bytes: Bytes }): Signature {
      const signatureBytes = bytes instanceof Uint8Array ? bytes : bytes.bytes;

      if (signatureBytes.length !== 64) {
        throw new Error(
          `Invalid Ed25519 signature length: expected 64, got ${signatureBytes.length}`
        );
      }

      return new Signature(Bytes.from(signatureBytes));
    }
  }

  export class VerifyingKey {
    constructor(
      private publicKeyBytes: Bytes,
      private publicKey: CryptoKey
    ) {}

    async verify(
      payload: Bytes | { bytes: Bytes },
      signature: Signature
    ): Promise<boolean> {
      const payloadBytes =
        payload instanceof Uint8Array ? payload : payload.bytes;
      const signatureBytes = signature.export().bytes;

      try {
        const verified = await crypto.subtle.verify(
          'Ed25519',
          this.publicKey,
          signatureBytes,
          payloadBytes
        );
        return verified;
      } catch (error) {
        throw new Error(`Ed25519 verification failed: ${error}`);
      }
    }

    async export() {
      return {
        bytes: Bytes.from(this.publicKeyBytes),
      };
    }

    static async import(
      bytes: Bytes | { bytes: Bytes },
      _extractable?: boolean
    ): Promise<VerifyingKey> {
      const keyBytes = bytes instanceof Uint8Array ? bytes : bytes.bytes;

      if (keyBytes.length !== 32) {
        throw new Error(
          `Invalid Ed25519 public key length: expected 32, got ${keyBytes.length}`
        );
      }

      try {
        const publicKey = await crypto.subtle.importKey(
          'raw',
          keyBytes,
          'Ed25519',
          true,
          ['verify']
        );

        return new VerifyingKey(Bytes.from(keyBytes), publicKey);
      } catch (error) {
        throw new Error(`Failed to import Ed25519 public key: ${error}`);
      }
    }
  }
}
