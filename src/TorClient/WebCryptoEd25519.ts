/**
 * WebCrypto-based Ed25519 factories
 * Works in Node.js 15+ and modern browsers
 * No initialization needed - stateless factories
 */

interface Copiable {
  readonly bytes: Uint8Array;
}

type BytesOrCopiable = Uint8Array | Copiable;

function toBytes(input: BytesOrCopiable): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }
  return input.bytes;
}

interface Signature extends Disposable {
  exportOrThrow(): Copiable;
}

interface VerifyingKey extends Disposable {
  verifyOrThrow(
    payload: BytesOrCopiable,
    signature: Signature
  ): Promise<boolean>;
  exportOrThrow(): Promise<Copiable>;
}

interface VerifyingKeyFactory {
  importOrThrow(
    bytes: BytesOrCopiable,
    extractable?: boolean
  ): Promise<VerifyingKey>;
}

interface SignatureFactory {
  importOrThrow(bytes: BytesOrCopiable): Signature;
}

/**
 * Implementation classes
 */

class WebCryptoSignature implements Signature {
  constructor(private data: Uint8Array) {}

  exportOrThrow(): Copiable {
    return {
      bytes: new Uint8Array(this.data),
    };
  }

  [Symbol.dispose](): void {
    // No resources to dispose
  }
}

class WebCryptoVerifyingKey implements VerifyingKey {
  constructor(
    private publicKeyBytes: Uint8Array,
    private publicKey: CryptoKey
  ) {}

  async verifyOrThrow(
    payload: BytesOrCopiable,
    signature: Signature
  ): Promise<boolean> {
    const payloadBytes = toBytes(payload);
    const signatureBytes = signature.exportOrThrow().bytes;

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

  async exportOrThrow(): Promise<Copiable> {
    return {
      bytes: new Uint8Array(this.publicKeyBytes),
    };
  }

  [Symbol.dispose](): void {
    // No resources to dispose
  }
}

class WebCryptoVerifyingKeyFactory implements VerifyingKeyFactory {
  async importOrThrow(
    bytes: BytesOrCopiable,
    _extractable?: boolean
  ): Promise<VerifyingKey> {
    const keyBytes = toBytes(bytes);

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

      return new WebCryptoVerifyingKey(new Uint8Array(keyBytes), publicKey);
    } catch (error) {
      throw new Error(`Failed to import Ed25519 public key: ${error}`);
    }
  }
}

class WebCryptoSignatureFactory implements SignatureFactory {
  importOrThrow(bytes: BytesOrCopiable): Signature {
    const signatureBytes = toBytes(bytes);

    if (signatureBytes.length !== 64) {
      throw new Error(
        `Invalid Ed25519 signature length: expected 64, got ${signatureBytes.length}`
      );
    }

    return new WebCryptoSignature(new Uint8Array(signatureBytes));
  }
}

/**
 * Ed25519 namespace with stateless factory instances
 */
export namespace Ed25519 {
  export const VerifyingKey = new WebCryptoVerifyingKeyFactory();
  export const Signature = new WebCryptoSignatureFactory();
}
