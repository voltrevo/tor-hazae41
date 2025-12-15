import { X509 } from '@hazae41/x509';
import { Writable } from '@hazae41/binary';
import { ccadbStaticBase64 } from './ccadbStatic.js';

export namespace CCADB {
  export interface Trusted {
    readonly hashBase16: string;
    readonly certBase16: string;
    readonly notAfter?: string;
  }

  let cachedTrusteds: Record<string, Trusted> | undefined;

  /**
   * Get all trusted root certificates.
   *
   * Dynamically parses base64-encoded X.509 certificates to extract:
   * - Subject DN (x501)
   * - SPKI hash (hashBase16)
   * - Expiration date (notAfter)
   *
   * Results are memoized on first call.
   */
  export async function getTrusteds(): Promise<Record<string, Trusted>> {
    if (cachedTrusteds) return cachedTrusteds;

    const result: Record<string, Trusted> = {};

    for (const base64 of ccadbStaticBase64) {
      try {
        // Decode base64 to DER bytes
        const derBytes = Buffer.from(base64, 'base64');

        // Parse X.509 certificate
        const x509 = X509.readAndResolveFromBytesOrThrow(
          X509.Certificate,
          derBytes
        );

        // Extract subject DN
        const x501 = x509.tbsCertificate.subject.toX501OrThrow();

        // Extract SPKI hash
        const spki = Writable.writeToBytesOrThrow(
          x509.tbsCertificate.subjectPublicKeyInfo.toDER()
        );
        const hash = new Uint8Array(
          await crypto.subtle.digest('SHA-256', spki)
        );
        const hashBase16 = Buffer.from(hash).toString('hex');

        // Convert DER to hex
        const certBase16 = derBytes.toString('hex');

        // Extract notAfter date
        const validity = x509.tbsCertificate.validity;
        const notAfter = validity.toJSON().notAfter;

        result[x501] = {
          hashBase16,
          certBase16,
          ...(notAfter && { notAfter }),
        };
      } catch (error) {
        console.warn('Failed to parse certificate:', error);
      }
    }

    cachedTrusteds = result;
    return cachedTrusteds;
  }
}
