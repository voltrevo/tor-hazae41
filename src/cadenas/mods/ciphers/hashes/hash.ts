import { Secrets } from "mods/ciphers/secrets.js"

export interface Hash {
  readonly mac: Maching
  readonly mac_length: number
  readonly mac_key_length: number

  readonly handshake_md: AlgorithmIdentifier
  readonly prf_md: AlgorithmIdentifier
}

export interface Maching {
  readonly mac_length: number
  readonly mac_key_length: number

  initOrThrow(secrets: Secrets): Promise<Macher>
}

export interface Macher {
  readonly mac_length: number
  readonly mac_key_length: number

  writeOrThrow(seed: Uint8Array): Promise<Uint8Array>
}