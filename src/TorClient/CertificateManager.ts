import { Circuit, Echalote } from '../echalote';
import { IStorage } from '../storage';
import { Log } from '../Log';
import { App } from './App';
import { Bytes } from '../hazae41/bytes';

export interface CertificateManagerOptions {
  app: App;
  maxCached: number;
}

/**
 * Manages certificate caching and retrieval for Tor consensus verification.
 * Handles loading, saving, and freshness checking of authority certificates.
 */
export class CertificateManager {
  private storage: IStorage;
  private maxCached: number;
  private log: Log;
  private certificateCache: Map<string, Echalote.Consensus.Certificate> =
    new Map();
  private cacheLoaded = false;
  private cacheLoading: Promise<void> | undefined;

  isClosed = false;

  constructor(options: CertificateManagerOptions) {
    this.storage = options.app.get('Storage');
    this.maxCached = options.maxCached; // More certificates than consensuses
    this.log = options.app.get('Log').child('CertificateManager');
  }

  /**
   * Gets a certificate for the given fingerprint, using cache when available or fetching when needed.
   * @param circuit The circuit to use for fetching if needed
   * @param fingerprint The certificate fingerprint to retrieve
   * @returns A verified certificate
   */
  async getCertificate(
    circuit: Circuit,
    fingerprint: string
  ): Promise<Echalote.Consensus.Certificate> {
    // Check cache first
    const cached = await this.loadCachedCertificate(fingerprint);
    if (cached && this.isCertificateValid(cached)) {
      this.log.info(`Using cached certificate for ${fingerprint}`);
      return cached;
    }

    this.log.info(`Fetching certificate for ${fingerprint} from network`);
    const certificate = await Echalote.Consensus.Certificate.fetchOrThrow(
      circuit,
      fingerprint
    );

    // Save to cache
    await this.saveToCache(certificate);
    this.log.info(`Cached certificate for ${fingerprint}`);

    return certificate;
  }

  /**
   * Gets multiple certificates in parallel, using cache when available.
   * @param circuit The circuit to use for fetching
   * @param fingerprints Array of certificate fingerprints to retrieve
   * @returns Array of verified certificates
   */
  async getCertificates(
    circuit: Circuit,
    fingerprints: string[]
  ): Promise<Echalote.Consensus.Certificate[]> {
    const certificates: Echalote.Consensus.Certificate[] = [];

    // Check cache for all fingerprints first
    const cachedResults = await Promise.all(
      fingerprints.map(async fingerprint => {
        const cached = await this.loadCachedCertificate(fingerprint);
        return { fingerprint, certificate: cached };
      })
    );

    // Separate cached from uncached
    const cachedCertificates: Echalote.Consensus.Certificate[] = [];
    const uncachedFingerprints: string[] = [];

    for (const { fingerprint, certificate } of cachedResults) {
      if (certificate && this.isCertificateValid(certificate)) {
        cachedCertificates.push(certificate);
        this.log.info(`Using cached certificate for ${fingerprint}`);
      } else {
        uncachedFingerprints.push(fingerprint);
      }
    }

    // Fetch uncached certificates in parallel
    if (uncachedFingerprints.length > 0) {
      this.log.info(
        `Fetching ${uncachedFingerprints.length} certificates from network`
      );
      const fetchedCertificates = await Promise.all(
        uncachedFingerprints.map(fingerprint =>
          Echalote.Consensus.Certificate.fetchOrThrow(circuit, fingerprint)
        )
      );

      // Cache the newly fetched certificates
      await Promise.all(
        fetchedCertificates.map(cert => this.saveToCache(cert))
      );

      certificates.push(...fetchedCertificates);
      this.log.info(`Cached ${fetchedCertificates.length} new certificates`);
    }

    certificates.push(...cachedCertificates);

    // Return in the same order as the input fingerprints
    const fingerprintToCert = new Map(
      certificates.map(cert => [cert.fingerprint, cert])
    );

    return fingerprints
      .map(fp => fingerprintToCert.get(fp))
      .filter(
        (cert): cert is Echalote.Consensus.Certificate => cert !== undefined
      );
  }

  /**
   * Checks if a certificate is still valid (not expired).
   * @param certificate The certificate to check
   * @returns True if the certificate is still valid
   */
  private isCertificateValid(
    certificate: Echalote.Consensus.Certificate
  ): boolean {
    const now = new Date();
    return now < certificate.expires;
  }

  /**
   * Loads cached certificates from storage.
   */
  private async loadCache(): Promise<void> {
    if (this.cacheLoaded) {
      return;
    }

    if (this.cacheLoading) {
      await this.cacheLoading;
      return;
    }

    this.cacheLoading = this.loadCacheInternal();
    await this.cacheLoading;
  }

  private async loadCacheInternal(): Promise<void> {
    try {
      this.log.info('Loading cached certificates from storage');
      const keys = await this.storage.list('cert:');

      if (keys.length === 0) {
        this.log.info('No cached certificates found');
        this.cacheLoaded = true;
        return;
      }

      let loadedCount = 0;
      let expiredCount = 0;

      for (const key of keys.slice(0, this.maxCached)) {
        try {
          const data = await this.storage.read(key);
          const text = new TextDecoder().decode(data);
          const certificate = await this.parseCertificate(text);

          if (this.isCertificateValid(certificate)) {
            this.certificateCache.set(certificate.fingerprint, certificate);
            loadedCount++;
            this.log.info(
              `Loaded cached certificate for ${certificate.fingerprint} (expires: ${certificate.expires.toISOString()})`
            );
          } else {
            expiredCount++;
            this.log.info(
              `Skipping expired certificate for ${certificate.fingerprint} (expired: ${certificate.expires.toISOString()})`
            );
            // Remove expired certificate from storage
            await this.storage.remove(key);
          }
        } catch (error) {
          this.log.error(
            `Failed to load certificate ${key}: ${(error as Error).message}`
          );
        }
      }

      this.log.info(
        `Loaded ${loadedCount} cached certificates, removed ${expiredCount} expired ones`
      );

      // Clean up old certificates if we have too many
      if (keys.length > this.maxCached) {
        const keysToRemove = keys.slice(this.maxCached);
        this.log.info(
          `Removing ${keysToRemove.length} old cached certificates`
        );
        for (const key of keysToRemove) {
          try {
            await this.storage.remove(key);
          } catch (error) {
            this.log.error(
              `Failed to remove old certificate ${key}: ${(error as Error).message}`
            );
          }
        }
      }
    } catch (error) {
      this.log.error(
        `Failed to load certificate cache: ${(error as Error).message}`
      );
    } finally {
      this.cacheLoaded = true;
    }
  }

  /**
   * Loads a specific certificate from cache by fingerprint.
   * @param fingerprint The certificate fingerprint to load
   * @returns The cached certificate or undefined if not found
   */
  private async loadCachedCertificate(
    fingerprint: string
  ): Promise<Echalote.Consensus.Certificate | undefined> {
    await this.loadCache();
    return this.certificateCache.get(fingerprint);
  }

  /**
   * Saves a certificate to the cache and storage.
   * @param certificate The certificate to save
   */
  async saveToCache(
    certificate: Echalote.Consensus.Certificate
  ): Promise<void> {
    try {
      const key = `cert:${certificate.fingerprint}`;

      // Serialize certificate to text format
      const textToSave = await this.serializeCertificate(certificate);
      const data = Bytes.fromUtf8(textToSave);
      await this.storage.write(key, data);

      // Update in-memory cache
      this.certificateCache.set(certificate.fingerprint, certificate);

      // Maintain cache size limit
      if (this.certificateCache.size > this.maxCached) {
        // Remove oldest entries (simple FIFO for now)
        const entries = Array.from(this.certificateCache.entries());
        const toRemove = entries.slice(0, entries.length - this.maxCached);
        for (const [fingerprint] of toRemove) {
          this.certificateCache.delete(fingerprint);
          await this.storage.remove(`cert:${fingerprint}`);
        }
      }

      this.log.info(`Saved certificate to cache: ${key}`);
    } catch (error) {
      this.log.error(
        `Failed to save certificate to cache: ${(error as Error).message}`
      );
    }
  }

  /**
   * Serializes a certificate back to its text format.
   * @param certificate The certificate to serialize
   * @returns The certificate text
   */
  private async serializeCertificate(
    certificate: Echalote.Consensus.Certificate
  ): Promise<string> {
    // For now, we'll store the certificate in a simple format
    // In a real implementation, we'd need to reconstruct the original text format
    // that the Certificate.parseOrThrow function expects
    return JSON.stringify({
      version: certificate.version,
      fingerprint: certificate.fingerprint,
      published: certificate.published.toISOString(),
      expires: certificate.expires.toISOString(),
      identityKey: certificate.identityKey,
      signingKey: certificate.signingKey,
      crossCert: certificate.crossCert,
      preimage: certificate.preimage,
      signature: certificate.signature,
    });
  }

  /**
   * Parses a certificate from text format.
   * @param text The certificate text to parse
   * @returns The parsed certificate
   */
  private async parseCertificate(
    text: string
  ): Promise<Echalote.Consensus.Certificate> {
    // Try to parse as JSON first (our cached format)
    try {
      const data = JSON.parse(text);
      return {
        ...data,
        published: new Date(data.published),
        expires: new Date(data.expires),
      };
    } catch {
      // If JSON parsing fails, try the original certificate format
      // This would be used if we stored the original certificate text
      const certificates = Echalote.Consensus.Certificate.parseOrThrow(text);
      if (certificates.length === 0) {
        throw new Error('No certificate found in text');
      }
      return certificates[0];
    }
  }

  close() {
    this.isClosed = true;
    this.certificateCache.clear();
  }
}
