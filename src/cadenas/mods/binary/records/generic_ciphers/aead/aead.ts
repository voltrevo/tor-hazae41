import {
  AEADCiphertextRecord,
  PlaintextRecord,
} from '../../../../../mods/binary/records/record.js';
import { AEADEncrypter } from '../../../../../mods/ciphers/encryptions/encryption.js';
import { Bytes } from '../../../../../../hazae41/bytes/index.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';
import { Unknown, Writable } from '../../../../../../hazae41/binary/mod.js';

export class GenericAEADCipher {
  constructor(
    readonly nonce_explicit: Bytes<8>,
    readonly block: Bytes
  ) {}

  sizeOrThrow() {
    return this.nonce_explicit.length + this.block.length;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.nonce_explicit);
    cursor.writeOrThrow(this.block);
  }

  static readOrThrow(cursor: Cursor) {
    const nonce_explicit = Bytes.from(cursor.readOrThrow(8));
    const block = Bytes.from(cursor.readOrThrow(cursor.remaining));

    return new GenericAEADCipher(nonce_explicit, block);
  }

  static async encryptOrThrow<T extends Writable>(
    record: PlaintextRecord<T>,
    encrypter: AEADEncrypter,
    sequence: bigint
  ) {
    const nonce = new Cursor(Bytes.alloc(encrypter.fixed_iv_length + 8));
    nonce.writeOrThrow(encrypter.secrets.client_write_IV);
    nonce.writeUint64OrThrow(sequence);

    nonce.offset = 0;
    const _nonce_implicit = Bytes.from(nonce.readOrThrow(4));
    const nonce_explicit = Bytes.from(nonce.readOrThrow(8));

    const content = Writable.writeToBytesOrThrow(record.fragment);

    const additional_data = new Cursor(Bytes.alloc(8 + 1 + 2 + 2));
    additional_data.writeUint64OrThrow(sequence);
    additional_data.writeUint8OrThrow(record.type);
    additional_data.writeUint16OrThrow(record.version);
    additional_data.writeUint16OrThrow(record.fragment.sizeOrThrow());

    // Console.debug("-> nonce", nonce.bytes.length, Bytes.toHex(nonce.bytes))
    // Console.debug("-> plaintext", content.length, Bytes.toHex(content))
    // Console.debug("-> additional_data", additional_data.bytes.length, Bytes.toHex(additional_data.bytes))

    const ciphertext = await encrypter.encryptOrThrow(
      nonce.bytes,
      content,
      additional_data.bytes
    );

    // Console.debug("-> ciphertext", ciphertext.length, Bytes.toHex(ciphertext))

    return new GenericAEADCipher(nonce_explicit, ciphertext);
  }

  async decryptOrThrow(
    record: AEADCiphertextRecord,
    encrypter: AEADEncrypter,
    sequence: bigint
  ) {
    const nonce = new Cursor(Bytes.alloc(encrypter.fixed_iv_length + 8));
    nonce.writeOrThrow(encrypter.secrets.server_write_IV);
    nonce.writeOrThrow(this.nonce_explicit);

    const additional_data = new Cursor(Bytes.alloc(8 + 1 + 2 + 2));
    additional_data.writeUint64OrThrow(sequence);
    additional_data.writeUint8OrThrow(record.type);
    additional_data.writeUint16OrThrow(record.version);
    additional_data.writeUint16OrThrow(record.fragment.sizeOrThrow() - 24);

    // Console.debug("<- nonce", nonce.bytes.length, Bytes.toHex(nonce.bytes))
    // Console.debug("<- ciphertext", this.block.length, Bytes.toHex(this.block))
    // Console.debug("<- additional_data", additional_data.bytes.length, Bytes.toHex(additional_data.bytes))

    const plaintext = await encrypter.decryptOrThrow(
      nonce.bytes,
      this.block,
      additional_data.bytes
    );

    // Console.debug("<- plaintext", plaintext.length, Bytes.toHex(plaintext))

    return new Unknown(plaintext);
  }
}
