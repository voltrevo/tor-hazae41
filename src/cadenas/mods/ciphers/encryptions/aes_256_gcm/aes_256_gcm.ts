import { Bytes } from '../../../../../hazae41/bytes/index.js';
import { Secrets } from '../../../../mods/ciphers/secrets.js';

export class AES_256_GCM {
  readonly #class = AES_256_GCM;

  static readonly cipher_type = 'aead' as const;
  static readonly enc_key_length = 32 as const;
  static readonly block_length = 16 as const;
  static readonly fixed_iv_length = 4 as const;
  static readonly record_iv_length = 8 as const;

  constructor(
    readonly secrets: Secrets, // TODO
    readonly encryption_key: CryptoKey,
    readonly decryption_key: CryptoKey
  ) {}

  static async initOrThrow(secrets: Secrets) {
    const encryption = await crypto.subtle.importKey(
      'raw',
      secrets.client_write_key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const decryption = await crypto.subtle.importKey(
      'raw',
      secrets.server_write_key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    return new AES_256_GCM(secrets, encryption, decryption);
  }

  get cipher_type() {
    return this.#class.cipher_type;
  }

  get enc_key_length() {
    return this.#class.enc_key_length;
  }

  get block_length() {
    return this.#class.block_length;
  }

  get fixed_iv_length() {
    return this.#class.fixed_iv_length;
  }

  get record_iv_length() {
    return this.#class.record_iv_length;
  }

  async encryptOrThrow(nonce: Bytes, block: Bytes, additionalData: Bytes) {
    return Bytes.from(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', length: 256, iv: nonce, additionalData },
        this.encryption_key,
        block
      )
    );
  }

  async decryptOrThrow(nonce: Bytes, block: Bytes, additionalData: Bytes) {
    return Bytes.from(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', length: 256, iv: nonce, additionalData },
        this.decryption_key,
        block
      )
    );
  }
}
