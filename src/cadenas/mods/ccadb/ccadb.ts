import { X509 } from '@hazae41/x509';
import { Writable } from '@hazae41/binary';
import { App } from '../../../TorClient/App.js';

export interface Trusted {
  readonly hashBase16: string;
  readonly certBase16: string;
  readonly notAfter?: string;
}

/**
 * Certificate provider that parses and caches root certificates.
 */
export class CCADB {
  private cached?: Record<string, Trusted>;
  private fetchCerts: () => Promise<string[]>;

  constructor(private app: App) {
    this.fetchCerts = app.get('fetchCerts');
  }

  /**
   * Get all trusted root certificates indexed by subject DN.
   *
   * Dynamically parses base64-encoded X.509 certificates to extract:
   * - Subject DN (x501)
   * - SPKI hash (hashBase16)
   * - DER bytes (certBase16)
   * - Expiration date (notAfter)
   *
   * Results are memoized on first call.
   */
  async get(): Promise<Record<string, Trusted>> {
    if (this.cached) return this.cached;

    const result: Record<string, Trusted> = {};

    const base64Certs = await this.fetchCerts();

    for (const base64 of base64Certs) {
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

    this.cached = result;
    return this.cached;
  }
}
