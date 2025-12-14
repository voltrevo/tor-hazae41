import { Secrets } from "mods/ciphers/secrets.js"

export class HMAC_SHA384 {
  readonly #class = HMAC_SHA384

  static readonly mac_length = 48 as const
  static readonly mac_key_length = 48 as const

  constructor(
    readonly mac_key: CryptoKey
  ) { }

  get mac_length() {
    return this.#class.mac_length
  }

  get mac_key_length() {
    return this.#class.mac_key_length
  }

  static async initOrThrow(secrets: Secrets) {
    const mac_key = await crypto.subtle.importKey("raw", secrets.client_write_MAC_key, { name: "HMAC", hash: "SHA-384" }, false, ["sign"])

    return new HMAC_SHA384(mac_key)
  }

  async writeOrThrow(seed: Uint8Array) {
    return new Uint8Array(await crypto.subtle.sign("HMAC", this.mac_key, seed))
  }

}

export class SHA384 {
  readonly #class = SHA384

  static readonly mac = HMAC_SHA384
  static readonly mac_length = 48 as const
  static readonly mac_key_length = 48 as const

  static readonly handshake_md = "SHA-384" as const
  static readonly prf_md = "SHA-384" as const

  constructor() { }

  get mac_length() {
    return this.#class.mac_length
  }

  get mac_key_length() {
    return this.#class.mac_key_length
  }
}
