import { Circuit, Consensus, Echalote } from '../echalote';
import { IStorage } from '../storage';
import { computeFullConsensusHash } from '../echalote/mods/tor/consensus/diff';
import { getErrorDetails } from '../utils/getErrorDetails';
import { IClock } from '../clock';
import { Future } from '@hazae41/future';
import { CertificateManager } from './CertificateManager';
import { Log } from '../Log';

// FIXME
// - ConsensusManager should be given a way to get its circuit on construction
// - this should be implemented by CircuitManager and it should keep the same
//   circuit for ConsensusManager unless it needs to be rebuilt (new tor
//   connection)

export interface ConsensusManagerOptions {
  /** Clock instance for managing delays */
  clock: IClock;
  storage: IStorage;
  maxCached?: number;
  log: Log;
}

/**
 * Manages consensus caching and retrieval for Tor circuits.
 * Handles loading, saving, and freshness checking of consensus documents.
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 * Instances are created by TorClient and should not be instantiated manually.
 */
export class ConsensusManager {
  private clock: IClock;
  private storage: IStorage;
  private maxCached: number;
  private log: Log;
  // Cache maintains chronological order (oldest first, newest last)
  // This order is required for Tor nodes to properly return 304 responses
  private consensusCache: Echalote.Consensus[] = [];
  private cacheLoaded = false;
  private cacheLoading: Promise<void> | undefined;
  private backgroundUpdating = false;

  private inFlightFetch: Promise<Consensus> | undefined;
  private certificateManager: CertificateManager;

  isClosed = false;

  constructor(options: ConsensusManagerOptions) {
    this.clock = options.clock;
    this.storage = options.storage;
    this.maxCached = options.maxCached ?? 5;
    this.log = options.log;
    this.certificateManager = new CertificateManager({
      storage: options.storage,
      maxCached: 20,
      log: this.log.child('certificates'),
    });
  }

  /**
   * Gets a consensus for the given circuit, using cache when fresh or fetching when needed.
   * @param circuit The circuit to use for fetching if needed
   * @returns A fresh consensus document
   */
  async getConsensus(circuit: Circuit): Promise<Echalote.Consensus> {
    this.backgroundUpdate(circuit);

    const { consensus, status } = await this.loadCachedConsensus();

    if (status === 'fresh') {
      this.log.info('Providing fresh cached consensus');
    } else if (status === 'stale') {
      this.log.info(
        'Providing stale cached consensus, a fresh one will be sought separately'
      );
    } else if (status === 'invalid') {
      this.log.info('Cached consensus is no longer valid, fetching a new one');
    } else if (status === 'none') {
      this.log.info('No cached consensus, fetching a new one');
    }

    if (consensus) {
      return consensus;
    }

    const newConsensus = await this.fetchConsensus(circuit);

    return newConsensus;
  }

  private async fetchConsensus(circuit: Circuit) {
    if (!this.inFlightFetch) {
      this.inFlightFetch = this.rawFetchConsensus(circuit);

      this.inFlightFetch.finally(() => {
        this.inFlightFetch = undefined;
      });
    }

    return await this.inFlightFetch;
  }

  private async rawFetchConsensus(circuit: Circuit) {
    const cache = await this.loadCache();

    this.log.info('Fetching consensus from network');
    const consensus = await Echalote.Consensus.fetchOrThrow(
      circuit,
      cache,
      undefined,
      this.certificateManager
    );
    this.log.info(
      `Consensus fetched with ${consensus.microdescs.length} microdescs`
    );

    // Save to cache
    await this.saveToCache(consensus);

    return consensus;
  }

  /**
   * Loads cached consensuses from storage.
   */
  private async loadCache(): Promise<Consensus[]> {
    if (this.cacheLoaded) {
      return this.consensusCache;
    }

    if (this.cacheLoading) {
      await this.cacheLoading;
      return this.consensusCache;
    }

    const cacheLoadingFuture = new Future<void>();
    this.cacheLoading = cacheLoadingFuture.promise;

    try {
      this.log.info('Loading cached consensuses from storage');
      const keys = await this.storage.list('consensus:');

      if (keys.length === 0) {
        this.log.info('No cached consensuses found');
        this.cacheLoaded = true;
        return this.consensusCache;
      }

      // Sort keys by timestamp (oldest first, for chronological order)
      const sortedKeys = keys.sort();

      // Load consensuses
      const consensuses: Echalote.Consensus[] = [];
      for (const key of sortedKeys.slice(0, this.maxCached)) {
        try {
          const data = await this.storage.read(key);
          const text = new TextDecoder().decode(data);
          const consensus = await Echalote.Consensus.parseOrThrow(text);
          consensuses.push(consensus);
          this.log.info(
            `Loaded cached consensus from ${consensus.validAfter.toISOString()}`
          );
        } catch (error) {
          this.log.error(
            `Failed to load consensus ${key}: ${(error as Error).message}`
          );
        }
      }

      this.consensusCache = consensuses;
      this.log.info(`Loaded ${consensuses.length} cached consensus(es)`);

      // Clean up old consensuses
      if (sortedKeys.length > this.maxCached) {
        const keysToRemove = sortedKeys.slice(this.maxCached);
        this.log.info(
          `Removing ${keysToRemove.length} old cached consensus(es)`
        );
        for (const key of keysToRemove) {
          try {
            await this.storage.remove(key);
          } catch (error) {
            this.log.error(
              `Failed to remove old consensus ${key}: ${(error as Error).message}`
            );
          }
        }
      }
    } catch (error) {
      this.log.error(
        `Failed to load consensus cache: ${(error as Error).message}`
      );
    } finally {
      this.cacheLoaded = true;
      cacheLoadingFuture.resolve();
    }

    return this.consensusCache;
  }

  private async loadCachedConsensus(): Promise<
    | { status: 'none' | 'invalid'; consensus: undefined }
    | { status: 'fresh' | 'stale'; consensus: Consensus }
  > {
    const cache = await this.loadCache();
    const consensus = cache.slice(-1)[0];

    if (!consensus) {
      return { status: 'none', consensus: undefined };
    }

    const now = new Date();

    if (now < consensus.freshUntil) {
      return { status: 'fresh', consensus };
    }

    if (now < consensus.validUntil) {
      return { status: 'stale', consensus };
    }

    return { status: 'invalid', consensus: undefined };
  }

  /**
   * Saves a consensus to the cache and storage.
   * @param consensus The consensus to save
   */
  private async saveToCache(consensus: Echalote.Consensus): Promise<void> {
    try {
      // Use ISO timestamp for sortable keys
      const timestamp = consensus.validAfter
        .toISOString()
        .replace(/[:.]/g, '_');
      const key = `consensus:${timestamp}`;

      // Reconstruct the full consensus text from preimage + signatureText
      const textToSave = await this.serializeConsensus(consensus);
      const data = new TextEncoder().encode(textToSave);
      await this.storage.write(key, data);

      this.log.info(`Saved consensus to cache: ${key}`);

      // Update cache - append to end to maintain chronological order
      this.consensusCache.push(consensus);

      // Keep only the most recent consensuses (remove oldest)
      if (this.consensusCache.length > this.maxCached) {
        this.consensusCache = this.consensusCache.slice(-this.maxCached);
      }

      // Clean up old consensuses from storage
      const keys = await this.storage.list('consensus:');
      if (keys.length > this.maxCached) {
        const sortedKeys = keys.sort(); // chronological order
        const keysToRemove = sortedKeys.slice(0, keys.length - this.maxCached);
        for (const oldKey of keysToRemove) {
          try {
            await this.storage.remove(oldKey);
            this.log.info(`Removed old cached consensus: ${oldKey}`);
          } catch (error) {
            this.log.error(
              `Failed to remove old consensus ${oldKey}: ${(error as Error).message}`
            );
          }
        }
      }
    } catch (error) {
      this.log.error(
        `Failed to save consensus to cache: ${(error as Error).message}`
      );
    }
  }

  private async backgroundUpdate(circuit: Circuit) {
    if (this.backgroundUpdating) {
      return;
    }

    this.backgroundUpdating = true;

    try {
      await this.rawBackgroundUpdate(circuit);
    } catch (e) {
      this.log.error(`backgroundUpdate failed: ${getErrorDetails(e)}`);
    } finally {
      this.backgroundUpdating = false;
    }
  }

  private async rawBackgroundUpdate(circuit: Circuit) {
    const info = await this.loadCachedConsensus();

    if (info.status === 'fresh') {
      const timeTilStale = info.consensus.freshUntil.getTime() - Date.now();
      await this.clock.delay(timeTilStale + 60_000);
    }

    const endTime = Date.now() + 3_600_000;

    while (Date.now() < endTime && !this.isClosed) {
      const consensus = await this.fetchConsensus(circuit);
      const isFresh = new Date() < consensus.freshUntil;

      if (isFresh) {
        break;
      }

      await this.clock.delay(3 * 60_000);
    }
  }

  /**
   * Serializes a consensus back to its full text format.
   * Reconstructs the original consensus document from preimage and signatureText.
   * Verifies the reconstruction matches the original by checking the hash.
   */
  private async serializeConsensus(
    consensus: Echalote.Consensus
  ): Promise<string> {
    // Combine preimage and signature text to reconstruct full consensus
    const text = consensus.preimage + consensus.signatureText;

    // Verify the reconstruction is correct by checking the hash
    if (consensus.fullTextHash) {
      const reconstructedHash = await computeFullConsensusHash(text);
      if (reconstructedHash !== consensus.fullTextHash) {
        throw new Error(
          `Consensus reconstruction failed: hash mismatch. ` +
            `Expected ${consensus.fullTextHash}, got ${reconstructedHash}`
        );
      }
    }

    return text;
  }

  close() {
    this.isClosed = true;
    this.certificateManager.close();
  }
}
