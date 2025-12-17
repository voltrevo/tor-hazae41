import { Base64 } from '@hazae41/base64';
import { Base16 } from '@hazae41/base16';
import { X509 } from '@hazae41/x509';
import { Writable } from '@hazae41/binary';
import { App } from '../../../TorClient/App.js';
import { certHashes } from './certHashes.js';
import type { FetchCerts, CertificateSource } from './fetchCerts.js';
import type { IStorage } from '../../../storage/index.js';
import type { IClock } from '../../../clock/IClock.js';
import { Log } from '../../../Log/index.js';

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
    readonly notFound: number;
  };
}

interface CachePayload {
  readonly version: 1;
  readonly savedAt: string;
  readonly base64Certs: string[];
}

/**
 * Certificate provider that parses and caches root certificates.
 * Supports persistent storage with 30-day expiry.
 * Stores raw base64 certificates and re-validates them on load from storage.
 */
export class CCADB {
  private cached?: Record<string, Trusted>;
  private fetchCerts: FetchCerts;
  private whitelistSet = new Set(certHashes);
  private storage: IStorage;
  private clock: IClock;
  private log: Log;

  private static readonly STORAGE_KEY = 'ccadb:cached';
  private static readonly CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  constructor(private app: App) {
    this.fetchCerts = app.get('fetchCerts');
    this.storage = app.get('Storage');
    this.clock = app.get('Clock');
    this.log = app.get('Log').child('CCADB');
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
    const base64Certs = await this.fetchCerts(
      this.log.child('fetchCerts'),
      source
    );
    return this.validateAndParseBase64Certs(base64Certs);
  }

  /**
   * Validate and parse pre-fetched base64 certificates.
   * Used internally when we have base64 data from storage or other sources.
   */
  private async validateAndParseBase64Certs(
    base64Certs: string[]
  ): Promise<ValidationResult> {
    const result: Record<string, Trusted> = {};
    let matched = 0;
    let unrecognized = 0;

    for (const base64 of base64Certs) {
      try {
        // Decode base64 to DER bytes
        const derBytes = Base64.get()
          .getOrThrow()
          .decodePaddedOrThrow(base64).bytes;

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
        const hashBase16 = Base16.encodeOrThrow(hash);

        // Check if certificate is in whitelist
        if (!this.whitelistSet.has(hashBase16)) {
          unrecognized++;
          continue;
        }

        matched++;

        // Extract subject DN
        const x501 = x509.tbsCertificate.subject.toX501OrThrow();

        // Convert DER to hex
        const certBase16 = Base16.encodeOrThrow(derBytes);

        // Extract notAfter date
        const validity = x509.tbsCertificate.validity;
        const notAfter = validity.toJSON().notAfter;

        result[x501] = {
          hashBase16,
          certBase16,
          ...(notAfter && { notAfter }),
        };
      } catch (error) {
        this.log.warn('Failed to parse certificate:', error);
      }
    }

    return {
      certificates: result,
      diagnostics: {
        matched,
        unrecognized,
        notFound: this.whitelistSet.size - matched,
      },
    };
  }

  /**
   * Load raw base64 certificates from persistent storage if they exist and are fresh.
   * Returns base64 strings for re-validation, or null if cache miss/expired.
   */
  private async loadFromStorage(): Promise<string[] | null> {
    try {
      const data = await this.storage.read(CCADB.STORAGE_KEY);
      if (!data) {
        this.log.info('Cache miss: no stored certificates found');
        return null;
      }

      const text = new TextDecoder().decode(data);
      const payload = JSON.parse(text) as CachePayload;

      const savedAt = new Date(payload.savedAt).getTime();
      const now = this.clock.now();
      const age = now - savedAt;

      if (age > CCADB.CACHE_EXPIRY_MS) {
        this.log.info(
          `Cache miss: stored certificates expired (age: ${Math.floor(age / 1000 / 60 / 60 / 24)} days)`
        );
        return null;
      }

      const certCount = payload.base64Certs.length;
      this.log.info(
        `Cache hit: loaded ${certCount} base64 certificates (age: ${Math.floor(age / 1000 / 60)} minutes)`
      );
      return payload.base64Certs;
    } catch (error) {
      this.log.warn(
        `Cache miss: failed to load from storage: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Save raw base64 certificates to persistent storage with current timestamp.
   */
  private async saveToStorage(base64Certs: string[]): Promise<void> {
    try {
      const payload: CachePayload = {
        version: 1,
        savedAt: new Date(this.clock.now()).toISOString(),
        base64Certs,
      };

      const text = JSON.stringify(payload);
      const data = new TextEncoder().encode(text);
      await this.storage.write(CCADB.STORAGE_KEY, data);

      this.log.info(
        `Saved ${base64Certs.length} base64 certificates to storage`
      );
    } catch (error) {
      this.log.error(
        `Failed to save certificates to storage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Clear cached certificates from memory and storage.
   * Useful for testing and forcing a fresh fetch.
   */
  async clearCache(): Promise<void> {
    try {
      this.cached = undefined;
      await this.storage.remove(CCADB.STORAGE_KEY);
      this.log.info('Cleared certificate cache');
    } catch (error) {
      this.log.warn(
        `Failed to clear storage cache: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all trusted root certificates indexed by subject DN.
   *
   * Results are cached in memory and persisted to storage with 30-day expiry.
   * Storage stores raw base64 certificates which are re-validated on load.
   * On subsequent calls, will load from storage if fresh and re-validate,
   * otherwise fetches fresh certificates.
   */
  async get(): Promise<Record<string, Trusted>> {
    if (this.cached) {
      this.log.debug('Using in-memory cached certificates');
      return this.cached;
    }

    this.log.info('Checking storage for cached certificates');
    const base64CertsFromStorage = await this.loadFromStorage();
    if (base64CertsFromStorage) {
      // Found fresh cached base64 certs - validate them
      this.log.info('Re-validating base64 certificates loaded from storage');
      const { certificates } = await this.validateAndParseBase64Certs(
        base64CertsFromStorage
      );
      this.cached = certificates;
      return this.cached;
    }

    this.log.info('Fetching fresh certificates');
    const base64Certs = await this.fetchCerts(this.log.child('fetchCerts'));
    const { certificates } =
      await this.validateAndParseBase64Certs(base64Certs);
    this.cached = certificates;

    // Save the raw base64 certs to storage for later re-validation
    await this.saveToStorage(base64Certs);
    return this.cached;
  }
}
