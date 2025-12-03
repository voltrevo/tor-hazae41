import { Circuit, Echalote } from '../echalote';
import { IStorage } from 'tor-hazae41/storage';

export interface ConsensusManagerOptions {
  storage: IStorage;
  maxCached?: number;
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

/**
 * Manages consensus caching and retrieval for Tor circuits.
 * Handles loading, saving, and freshness checking of consensus documents.
 */
export class ConsensusManager {
  private storage: IStorage;
  private maxCached: number;
  private onLog?: (
    message: string,
    type?: 'info' | 'success' | 'error'
  ) => void;
  private consensusCache: Echalote.Consensus[] = [];
  private cacheLoaded = false;

  constructor(options: ConsensusManagerOptions) {
    this.storage = options.storage;
    this.maxCached = options.maxCached ?? 5;
    this.onLog = options.onLog;
  }

  /**
   * Gets a consensus for the given circuit, using cache when fresh or fetching when needed.
   * @param circuit The circuit to use for fetching if needed
   * @returns A fresh consensus document
   */
  async getConsensus(circuit: Circuit): Promise<Echalote.Consensus> {
    // Load consensus cache if not already loaded
    await this.loadCache();

    // Check if we have a fresh consensus in cache
    let consensus: Echalote.Consensus | undefined;
    const now = new Date();

    if (this.consensusCache.length > 0) {
      const mostRecent = this.consensusCache[0];
      if (mostRecent.freshUntil > now) {
        const secondsUntilStale = Math.floor(
          (mostRecent.freshUntil.getTime() - now.getTime()) / 1000
        );
        this.log(
          `Using cached consensus (fresh for ${secondsUntilStale}s more)`,
          'success'
        );
        consensus = mostRecent;
      } else {
        this.log('Cached consensus is stale, fetching new one');
      }
    } else {
      this.log('No cached consensus available');
    }

    // Fetch consensus if we don't have a fresh one
    if (!consensus) {
      this.log('Fetching consensus from network');
      consensus = await Echalote.Consensus.fetchOrThrow(
        circuit,
        this.consensusCache
      );
      this.log(
        `Consensus fetched with ${consensus.microdescs.length} microdescs`,
        'success'
      );

      // Save to cache
      await this.saveToCache(consensus);
    }

    return consensus;
  }

  /**
   * Loads cached consensuses from storage.
   */
  private async loadCache(): Promise<void> {
    if (this.cacheLoaded) {
      return;
    }

    try {
      this.log('Loading cached consensuses from storage');
      const keys = await this.storage.list('consensus:');

      if (keys.length === 0) {
        this.log('No cached consensuses found');
        this.cacheLoaded = true;
        return;
      }

      // Sort keys by timestamp (newest first)
      const sortedKeys = keys.sort().reverse();

      // Load consensuses
      const consensuses: Echalote.Consensus[] = [];
      for (const key of sortedKeys.slice(0, this.maxCached)) {
        try {
          const data = await this.storage.read(key);
          const text = new TextDecoder().decode(data);
          const consensus = Echalote.Consensus.parseOrThrow(text);
          consensuses.push(consensus);
          this.log(
            `Loaded cached consensus from ${consensus.validAfter.toISOString()}`
          );
        } catch (error) {
          this.log(
            `Failed to load consensus ${key}: ${(error as Error).message}`,
            'error'
          );
        }
      }

      this.consensusCache = consensuses;
      this.log(`Loaded ${consensuses.length} cached consensus(es)`, 'success');

      // Clean up old consensuses
      if (sortedKeys.length > this.maxCached) {
        const keysToRemove = sortedKeys.slice(this.maxCached);
        this.log(`Removing ${keysToRemove.length} old cached consensus(es)`);
        for (const key of keysToRemove) {
          try {
            await this.storage.remove(key);
          } catch (error) {
            this.log(
              `Failed to remove old consensus ${key}: ${(error as Error).message}`,
              'error'
            );
          }
        }
      }
    } catch (error) {
      this.log(
        `Failed to load consensus cache: ${(error as Error).message}`,
        'error'
      );
    } finally {
      this.cacheLoaded = true;
    }
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

      const data = new TextEncoder().encode(consensus.preimage);
      await this.storage.write(key, data);

      this.log(`Saved consensus to cache: ${key}`);

      // Update cache
      this.consensusCache.unshift(consensus);

      // Keep only the most recent consensuses
      if (this.consensusCache.length > this.maxCached) {
        this.consensusCache = this.consensusCache.slice(0, this.maxCached);
      }

      // Clean up old consensuses from storage
      const keys = await this.storage.list('consensus:');
      if (keys.length > this.maxCached) {
        const sortedKeys = keys.sort().reverse();
        const keysToRemove = sortedKeys.slice(this.maxCached);
        for (const oldKey of keysToRemove) {
          try {
            await this.storage.remove(oldKey);
            this.log(`Removed old cached consensus: ${oldKey}`);
          } catch (error) {
            this.log(
              `Failed to remove old consensus ${oldKey}: ${(error as Error).message}`,
              'error'
            );
          }
        }
      }
    } catch (error) {
      this.log(
        `Failed to save consensus to cache: ${(error as Error).message}`,
        'error'
      );
    }
  }

  private log(
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ): void {
    if (this.onLog) {
      this.onLog(message, type);
    }
  }
}
