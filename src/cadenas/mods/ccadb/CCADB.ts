import { X509 } from '@hazae41/x509';
import { Writable } from '@hazae41/binary';
import { App } from '../../../TorClient/App.js';
import { certHashes } from './certHashes.js';
import type { FetchCerts, CertificateSource } from './fetchCerts.js';

export interface Trusted {
  readonly hashBase16: string;
  readonly certBase16: string;
  readonly notAfter?: string;
}

export interface ValidationResult {
  readonly certificates: Record<string, Trusted>;
  readonly diagnostics: {
    readonly matched: number;
    readonly unrecognized: number;
  };
}

/**
 * Certificate provider that parses and caches root certificates.
 */
export class CCADB {
  private cached?: Record<string, Trusted>;
  private fetchCerts: FetchCerts;
  private whitelistSet = new Set(certHashes);

  constructor(private app: App) {
    this.fetchCerts = app.get('fetchCerts');
  }

  /**
   * Validate and parse certificates without memoization.
   * Returns both the parsed certificates and validation diagnostics.
   *
   * Parses base64-encoded X.509 certificates to extract:
   * - Subject DN (x501)
   * - SPKI hash (hashBase16)
   * - DER bytes (certBase16)
   * - Expiration date (notAfter)
   *
   * Only includes certificates whose SPKI hash matches the whitelist.
   *
   * @param source - Optional specific certificate source to validate. If not provided, uses the default fallback chain.
   */
  async validateAndParseCerts(
    source?: CertificateSource
  ): Promise<ValidationResult> {
    const result: Record<string, Trusted> = {};
    let matched = 0;
    let unrecognized = 0;

    const base64Certs = await this.fetchCerts(source);

    for (const base64 of base64Certs) {
      try {
        // Decode base64 to DER bytes
        const derBytes = Buffer.from(base64, 'base64');

        // Parse X.509 certificate
        const x509 = X509.readAndResolveFromBytesOrThrow(
          X509.Certificate,
          derBytes
        );

        // Extract SPKI hash
        const spki = Writable.writeToBytesOrThrow(
          x509.tbsCertificate.subjectPublicKeyInfo.toDER()
        );
        const hash = new Uint8Array(
          await crypto.subtle.digest('SHA-256', spki)
        );
        const hashBase16 = Buffer.from(hash).toString('hex');

        // Check if certificate is in whitelist
        if (!this.whitelistSet.has(hashBase16)) {
          unrecognized++;
          continue;
        }

        matched++;

        // Extract subject DN
        const x501 = x509.tbsCertificate.subject.toX501OrThrow();

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

    return {
      certificates: result,
      diagnostics: {
        matched,
        unrecognized,
      },
    };
  }

  /**
   * Get all trusted root certificates indexed by subject DN.
   *
   * Results are memoized on first call.
   */
  async get(): Promise<Record<string, Trusted>> {
    if (this.cached) return this.cached;

    const { certificates } = await this.validateAndParseCerts();
    this.cached = certificates;
    return this.cached;
  }
}
