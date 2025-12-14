import { Opaque, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Lengthed } from "@hazae41/lengthed";
import { AEADCiphertextRecord, PlaintextRecord } from "mods/binary/records/record.js";
import { AEADEncrypter } from "mods/ciphers/encryptions/encryption.js";

export class GenericAEADCipher {

  constructor(
    readonly nonce_explicit: Uint8Array<ArrayBuffer> & Lengthed<8>,
    readonly block: Uint8Array<ArrayBuffer>
  ) { }

  sizeOrThrow() {
    return this.nonce_explicit.length + this.block.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.nonce_explicit)
    cursor.writeOrThrow(this.block)
  }

  static readOrThrow(cursor: Cursor) {
    const nonce_explicit = new Uint8Array(cursor.readOrThrow(8)) as Uint8Array<ArrayBuffer> & Lengthed<8>
    const block = new Uint8Array(cursor.readOrThrow(cursor.remaining))

    return new GenericAEADCipher(nonce_explicit, block)
  }

  static async encryptOrThrow<T extends Writable>(record: PlaintextRecord<T>, encrypter: AEADEncrypter, sequence: bigint) {
    const nonce = new Cursor(new Uint8Array(encrypter.fixed_iv_length + 8))
    nonce.writeOrThrow(encrypter.secrets.client_write_IV)
    nonce.writeUint64OrThrow(sequence)

    nonce.offset = 0
    const nonce_implicit = new Uint8Array(nonce.readOrThrow(4))
    const nonce_explicit = new Uint8Array(nonce.readOrThrow(8)) as Uint8Array<ArrayBuffer> & Lengthed<8>

    const content = Writable.writeToBytesOrThrow(record.fragment)

    const additional_data = new Cursor(new Uint8Array(8 + 1 + 2 + 2))
    additional_data.writeUint64OrThrow(sequence)
    additional_data.writeUint8OrThrow(record.type)
    additional_data.writeUint16OrThrow(record.version)
    additional_data.writeUint16OrThrow(record.fragment.sizeOrThrow())

    // Console.debug("-> nonce", nonce.bytes.length, Bytes.toHex(nonce.bytes))
    // Console.debug("-> plaintext", content.length, Bytes.toHex(content))
    // Console.debug("-> additional_data", additional_data.bytes.length, Bytes.toHex(additional_data.bytes))

    const ciphertext = await encrypter.encryptOrThrow(nonce.bytes, content, additional_data.bytes)

    // Console.debug("-> ciphertext", ciphertext.length, Bytes.toHex(ciphertext))

    return new GenericAEADCipher(nonce_explicit, ciphertext)
  }

  async decryptOrThrow(record: AEADCiphertextRecord, encrypter: AEADEncrypter, sequence: bigint) {
    const nonce = new Cursor(new Uint8Array(encrypter.fixed_iv_length + 8))
    nonce.writeOrThrow(encrypter.secrets.server_write_IV)
    nonce.writeOrThrow(this.nonce_explicit)

    const additional_data = new Cursor(new Uint8Array(8 + 1 + 2 + 2))
    additional_data.writeUint64OrThrow(sequence)
    additional_data.writeUint8OrThrow(record.type)
    additional_data.writeUint16OrThrow(record.version)
    additional_data.writeUint16OrThrow(record.fragment.sizeOrThrow() - 24)

    // Console.debug("<- nonce", nonce.bytes.length, Bytes.toHex(nonce.bytes))
    // Console.debug("<- ciphertext", this.block.length, Bytes.toHex(this.block))
    // Console.debug("<- additional_data", additional_data.bytes.length, Bytes.toHex(additional_data.bytes))

    const plaintext = await encrypter.decryptOrThrow(nonce.bytes, this.block, additional_data.bytes)

    // Console.debug("<- plaintext", plaintext.length, Bytes.toHex(plaintext))

    return new Opaque(plaintext)
  }

}