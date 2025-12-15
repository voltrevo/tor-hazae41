import { Circuit, Echalote } from '../echalote';
import { IStorage } from '../storage';
import { Log } from '../Log';
import { invariant } from '../utils/debug';
import { App } from './App';

export interface MicrodescManagerOptions {
  app: App;
  maxCached: number;
}

/**
 * Manages microdescriptor caching and retrieval for Tor circuits.
 * Handles loading, saving, and fetching of relay microdescriptors.
 * Microdescs are cached using their SHA-256 hash as the key.
 */
export class MicrodescManager {
  private storage: IStorage;
  private maxCached: number;
  private log: Log;
  private microdescCache: Map<string, Echalote.Consensus.Microdesc> = new Map();
  private cacheLoaded = false;
  private cacheLoading: Promise<void> | undefined;

  isClosed = false;

  constructor(options: MicrodescManagerOptions) {
    this.storage = options.app.get('Storage');
    this.maxCached = options.maxCached; // Large cache for frequently-used relays
    this.log = options.app.get('Log').child('MicrodescManager');
  }

  /**
   * Gets a microdescriptor for the given hash, using cache when available or fetching when needed.
   * @param circuit The circuit to use for fetching if needed
   * @param ref The relay head information containing the microdesc hash
   * @returns A verified microdescriptor
   */
  async getMicrodesc(
    circuit: Circuit,
    ref: Echalote.Consensus.Microdesc.Head
  ): Promise<Echalote.Consensus.Microdesc> {
    // Check cache first
    const cached = await this.loadCachedMicrodesc(ref.microdesc);
    if (cached) {
      invariant(
        cached.microdesc === ref.microdesc,
        `Cached microdesc hash must match requested hash`
      );
      this.log.info(`Using cached microdesc for ${ref.identity.slice(0, 8)}`);
      return cached;
    }

    this.log.info(
      `Fetching microdesc for ${ref.identity.slice(0, 8)} from network`
    );
    const microdesc = await Echalote.Consensus.Microdesc.fetchOrThrow(
      circuit,
      ref
    );

    invariant(
      microdesc.microdesc === ref.microdesc,
      `Fetched microdesc hash must match requested hash`
    );

    // Save to cache
    await this.saveToCache(microdesc);
    this.log.info(`Cached microdesc for ${ref.identity.slice(0, 8)}`);

    return microdesc;
  }

  /**
   * Gets multiple microdescriptors in parallel, using cache when available.
   * @param circuit The circuit to use for fetching
   * @param refs Array of relay head information to retrieve
   * @returns Array of verified microdescriptors
   */
  async getMicrodescs(
    circuit: Circuit,
    refs: Echalote.Consensus.Microdesc.Head[]
  ): Promise<Echalote.Consensus.Microdesc[]> {
    if (refs.length === 0) return [];

    const microdescs: Echalote.Consensus.Microdesc[] = [];

    // Check cache for all microdescs first
    const cachedResults = await Promise.all(
      refs.map(async ref => {
        const cached = await this.loadCachedMicrodesc(ref.microdesc);
        return { ref, microdesc: cached };
      })
    );

    // Separate cached from uncached
    const cachedMicrodescs: Echalote.Consensus.Microdesc[] = [];
    const uncachedRefs: Echalote.Consensus.Microdesc.Head[] = [];

    for (const { ref, microdesc } of cachedResults) {
      if (microdesc) {
        invariant(
          microdesc.microdesc === ref.microdesc,
          `Cached microdesc hash must match requested hash`
        );
        cachedMicrodescs.push(microdesc);
      } else {
        uncachedRefs.push(ref);
      }
    }

    if (cachedMicrodescs.length > 0) {
      this.log.info(`Using ${cachedMicrodescs.length} cached microdescs`);
    }

    // Fetch uncached microdescs in batch
    if (uncachedRefs.length > 0) {
      this.log.info(`Fetching ${uncachedRefs.length} microdescs from network`);
      const fetchedMicrodescs =
        await Echalote.Consensus.Microdesc.fetchManyOrThrow(
          circuit,
          uncachedRefs
        );

      invariant(
        fetchedMicrodescs.length === uncachedRefs.length,
        `Fetched microdesc count must match requested count`
      );

      // Cache the newly fetched microdescs
      await Promise.all(fetchedMicrodescs.map(md => this.saveToCache(md)));

      microdescs.push(...fetchedMicrodescs);
      this.log.info(`Cached ${fetchedMicrodescs.length} new microdescs`);
    }

    microdescs.push(...cachedMicrodescs);

    // Return in the same order as the input refs
    const hashToMicrodesc = new Map(microdescs.map(md => [md.microdesc, md]));

    const result = refs
      .map(ref => hashToMicrodesc.get(ref.microdesc))
      .filter((md): md is Echalote.Consensus.Microdesc => md !== undefined);

    invariant(
      result.length === refs.length,
      `All requested microdescs must be returned, got ${result.length}/${refs.length}`
    );

    return result;
  }

  /**
   * Loads cached microdescs from storage.
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
      this.log.info('Loading cached microdescs from storage');
      const keys = await this.storage.list('microdesc:');

      if (keys.length === 0) {
        this.log.info('No cached microdescs found');
        this.cacheLoaded = true;
        return;
      }

      let loadedCount = 0;
      let errorCount = 0;

      // Load only up to maxCached items from storage
      for (const key of keys.slice(0, this.maxCached)) {
        try {
          const data = await this.storage.read(key);
          const text = new TextDecoder().decode(data);
          const microdesc = await this.parseMicrodesc(text);

          this.microdescCache.set(microdesc.microdesc, microdesc);
          loadedCount++;
        } catch (error) {
          errorCount++;
          this.log.error(
            `Failed to load microdesc ${key}: ${(error as Error).message}`
          );
        }
      }

      this.log.info(
        `Loaded ${loadedCount} cached microdescs${errorCount > 0 ? `, ${errorCount} errors` : ''}`
      );

      // Clean up old microdescs if we have too many
      if (keys.length > this.maxCached) {
        const keysToRemove = keys.slice(this.maxCached);
        this.log.info(`Removing ${keysToRemove.length} old cached microdescs`);
        for (const key of keysToRemove) {
          try {
            await this.storage.remove(key);
          } catch (error) {
            this.log.error(
              `Failed to remove old microdesc ${key}: ${(error as Error).message}`
            );
          }
        }
      }
    } catch (error) {
      this.log.error(
        `Failed to load microdesc cache: ${(error as Error).message}`
      );
    } finally {
      this.cacheLoaded = true;
    }
  }

  /**
   * Loads a specific microdesc from cache by hash.
   * @param hash The microdesc hash to load
   * @returns The cached microdesc or undefined if not found
   */
  private async loadCachedMicrodesc(
    hash: string
  ): Promise<Echalote.Consensus.Microdesc | undefined> {
    await this.loadCache();
    return this.microdescCache.get(hash);
  }

  /**
   * Saves a microdesc to the cache and storage.
   * @param microdesc The microdesc to save
   */
  async saveToCache(microdesc: Echalote.Consensus.Microdesc): Promise<void> {
    try {
      const key = `microdesc:${microdesc.microdesc}`;

      // Serialize microdesc to JSON format
      const textToSave = await this.serializeMicrodesc(microdesc);
      const data = new TextEncoder().encode(textToSave);
      await this.storage.write(key, data);

      // Update in-memory cache
      this.microdescCache.set(microdesc.microdesc, microdesc);

      // Maintain cache size limit
      if (this.microdescCache.size > this.maxCached) {
        // Remove oldest entries (FIFO)
        const entries = Array.from(this.microdescCache.entries());
        const toRemove = entries.slice(0, entries.length - this.maxCached);
        for (const [hash] of toRemove) {
          this.microdescCache.delete(hash);
          await this.storage.remove(`microdesc:${hash}`);
        }
      }

      this.log.info(`Saved microdesc to cache: ${key}`);
    } catch (error) {
      this.log.error(
        `Failed to save microdesc to cache: ${(error as Error).message}`
      );
    }
  }

  /**
   * Serializes a microdesc to JSON format for storage.
   * @param microdesc The microdesc to serialize
   * @returns The microdesc JSON
   */
  private async serializeMicrodesc(
    microdesc: Echalote.Consensus.Microdesc
  ): Promise<string> {
    return JSON.stringify({
      nickname: microdesc.nickname,
      identity: microdesc.identity,
      date: microdesc.date,
      hour: microdesc.hour,
      hostname: microdesc.hostname,
      orport: microdesc.orport,
      dirport: microdesc.dirport,
      ipv6: microdesc.ipv6,
      microdesc: microdesc.microdesc,
      flags: microdesc.flags,
      version: microdesc.version,
      entries: microdesc.entries,
      bandwidth: microdesc.bandwidth,
      onionKey: microdesc.onionKey,
      ntorOnionKey: microdesc.ntorOnionKey,
      idEd25519: microdesc.idEd25519,
    });
  }

  /**
   * Parses a microdesc from JSON format.
   * @param text The microdesc JSON to parse
   * @returns The parsed microdesc
   */
  private async parseMicrodesc(
    text: string
  ): Promise<Echalote.Consensus.Microdesc> {
    const data = JSON.parse(text);
    return data as Echalote.Consensus.Microdesc;
  }

  close() {
    this.isClosed = true;
    this.microdescCache.clear();
  }
}
