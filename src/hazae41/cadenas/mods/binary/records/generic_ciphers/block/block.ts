import { BlockCiphertextRecord, PlaintextRecord } from '../../record.js';
import { BlockEncrypter } from '../../../../ciphers/encryptions/encryption.js';
import { Bytes } from '../../../../../../bytes/index.js';
import { Cursor } from '../../../../../../cursor/mod.js';
import { Unknown, Writable } from '../../../../../../binary/mod.js';

/**
 * (y % m) where (x + y) % m == 0
 * @nomaths Calculate the remaining y to add to x in order to reach the next m multiple
 * @param x value
 * @param m modulus
 * @returns y
 */
function modulup(x: number, m: number) {
  return (m - ((x + m) % m)) % m;
}

export class GenericBlockCipher {
  constructor(
    readonly iv: Bytes<16>,
    readonly block: Bytes
  ) {}

  sizeOrThrow() {
    return this.iv.length + this.block.length;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.iv);
    cursor.writeOrThrow(this.block);
  }

  static readOrThrow(cursor: Cursor) {
    const iv = cursor.readAndCopyOrThrow(16);
    const block = cursor.readAndCopyOrThrow(cursor.remaining);

    return new GenericBlockCipher(iv, block);
  }

  static async encryptOrThrow<T extends Writable>(
    record: PlaintextRecord<T>,
    encrypter: BlockEncrypter,
    sequence: bigint
  ) {
    const iv = Bytes.random(16);

    const content = Writable.writeToBytesOrThrow(record.fragment);

    const premac = new Cursor(Bytes.alloc(8 + record.sizeOrThrow()));
    premac.writeBigUint64OrThrow(sequence);
    record.writeOrThrow(premac);

    const mac = await encrypter.macher.writeOrThrow(premac.bytes);

    const length = content.length + mac.length;
    const padding_length = modulup(length + 1, 16);
    const padding = Bytes.alloc(padding_length + 1);

    padding.fill(padding_length);

    const plaintext = Bytes.concat(content, mac, padding);
    const ciphertext = await encrypter.encryptOrThrow(iv, plaintext);

    // Console.debug("-> iv", iv.length, Bytes.toHex(iv))
    // Console.debug("-> plaintext", plaintext.length, Bytes.toHex(plaintext))
    // Console.debug("-> content", content.length, Bytes.toHex(content))
    // Console.debug("-> mac", mac.length, Bytes.toHex(mac))
    // Console.debug("-> ciphertext", ciphertext.length, Bytes.toHex(ciphertext))

    return new GenericBlockCipher(iv, ciphertext);
  }

  async decryptOrThrow(
    record: BlockCiphertextRecord,
    encrypter: BlockEncrypter,
    _sequence: bigint
  ) {
    const plaintext = await encrypter.decryptOrThrow(this.iv, this.block);

    const content = plaintext.subarray(0, -encrypter.macher.mac_length);
    const _mac = plaintext.subarray(-encrypter.macher.mac_length);

    // Console.debug("<- content", content.length, Bytes.toHex(content))
    // Console.debug("<- mac", mac.length, Bytes.toHex(mac))

    return new Unknown(content);
  }
}
