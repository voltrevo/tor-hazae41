import { Macher, Maching } from "mods/ciphers/hashes/hash.js"
import { Secrets } from "mods/ciphers/secrets.js"

export type Encryption =
  | BlockEncryption
  | AEADEncryption

export interface BlockEncryption {
  readonly cipher_type: "block"
  readonly enc_key_length: number
  readonly fixed_iv_length: number
  readonly record_iv_length: number

  initOrThrow(secrets: Secrets, mac: Maching): Promise<BlockEncrypter>
}

export interface AEADEncryption {
  readonly cipher_type: "aead"
  readonly enc_key_length: number
  readonly fixed_iv_length: number
  readonly record_iv_length: number

  initOrThrow(secrets: Secrets): Promise<AEADEncrypter>
}

export type Encrypter =
  | BlockEncrypter
  | AEADEncrypter

export interface BlockEncrypter {
  readonly cipher_type: "block"
  readonly enc_key_length: number
  readonly fixed_iv_length: number
  readonly record_iv_length: number

  readonly macher: Macher

  encryptOrThrow(iv: Uint8Array, block: Uint8Array): Promise<Uint8Array>
  decryptOrThrow(iv: Uint8Array, block: Uint8Array): Promise<Uint8Array>
}

export interface AEADEncrypter {
  readonly cipher_type: "aead"
  readonly enc_key_length: number
  readonly fixed_iv_length: number
  readonly record_iv_length: number

  readonly secrets: Secrets

  encryptOrThrow(nonce: Uint8Array, block: Uint8Array, additionalData: Uint8Array): Promise<Uint8Array<ArrayBuffer>>
  decryptOrThrow(nonce: Uint8Array, block: Uint8Array, additionalData: Uint8Array): Promise<Uint8Array<ArrayBuffer>>
}