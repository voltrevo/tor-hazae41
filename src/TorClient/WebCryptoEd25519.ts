/**
 * WebCrypto-based Ed25519 implementation
 * Works in Node.js 15+ and modern browsers
 * No initialization needed - stateless factories
 */

export namespace Ed25519 {
  export class Signature {
    constructor(private data: Uint8Array) {}

    export() {
      return {
        bytes: new Uint8Array(this.data),
      };
    }

    static import(bytes: Uint8Array | { bytes: Uint8Array }): Signature {
      const signatureBytes = bytes instanceof Uint8Array ? bytes : bytes.bytes;

      if (signatureBytes.length !== 64) {
        throw new Error(
          `Invalid Ed25519 signature length: expected 64, got ${signatureBytes.length}`
        );
      }

      return new Signature(new Uint8Array(signatureBytes));
    }
  }

  export class VerifyingKey {
    constructor(
      private publicKeyBytes: Uint8Array,
      private publicKey: CryptoKey
    ) {}

    async verify(
      payload: Uint8Array | { bytes: Uint8Array },
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
        bytes: new Uint8Array(this.publicKeyBytes),
      };
    }

    static async import(
      bytes: Uint8Array | { bytes: Uint8Array },
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

        return new VerifyingKey(new Uint8Array(keyBytes), publicKey);
      } catch (error) {
        throw new Error(`Failed to import Ed25519 public key: ${error}`);
      }
    }
  }
}
