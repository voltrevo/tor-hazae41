import {
  AEADEncrypter,
  BlockEncrypter,
  Encryption,
} from './encryptions/encryption.js';
import { Hash } from './hashes/hash.js';
import { KeyExchange } from './key_exchanges/key_exchange.js';
import { Secrets } from './secrets.js';

export class Cipher {
  constructor(
    readonly id: number,
    readonly key_exchange: KeyExchange,
    readonly encryption: Encryption,
    readonly hash: Hash
  ) {}

  async initOrThrow(secrets: Secrets): Promise<BlockEncrypter | AEADEncrypter> {
    const { hash } = this;

    if (this.encryption.cipher_type === 'block')
      return await this.encryption.initOrThrow(secrets, hash.mac);
    else return await this.encryption.initOrThrow(secrets);
  }
}
