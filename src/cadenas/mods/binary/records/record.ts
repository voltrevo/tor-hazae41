import { Opaque, Writable } from '@hazae41/binary';
import { GenericAEADCipher } from '../../../mods/binary/records/generic_ciphers/aead/aead.js';
import { GenericBlockCipher } from '../../../mods/binary/records/generic_ciphers/block/block.js';
import {
  AEADEncrypter,
  BlockEncrypter,
  Encrypter,
} from '../../../mods/ciphers/encryptions/encryption.js';
import { Cursor } from '../../../../hazae41/cursor/mod.js';

export namespace Record {
  export const types = {
    invalid: 0,
    change_cipher_spec: 20,
    alert: 21,
    handshake: 22,
    application_data: 23,
  } as const;
}

export interface Recordable extends Writable {
  readonly record_type: number;
}

export class PlaintextRecord<T extends Writable> {
  constructor(
    readonly type: number,
    readonly version: number,
    readonly fragment: T
  ) {}

  static from<T extends Recordable>(record: T, version: number) {
    return new PlaintextRecord(record.record_type, version, record);
  }

  sizeOrThrow() {
    return 1 + 2 + 2 + this.fragment.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.type);
    cursor.writeUint16OrThrow(this.version);
    const size = this.fragment.sizeOrThrow();
    cursor.writeUint16OrThrow(size);
    this.fragment.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor): PlaintextRecord<Opaque> {
    const type = cursor.readUint8OrThrow();
    const version = cursor.readUint16OrThrow();
    const size = cursor.readUint16OrThrow();

    const bytes = cursor.readAndCopyOrThrow(size);
    const fragment = new Opaque(bytes);

    return new PlaintextRecord<Opaque>(type, version, fragment);
  }

  async #encryptBlockOrThrow(encrypter: BlockEncrypter, sequence: bigint) {
    const fragment = await GenericBlockCipher.encryptOrThrow<T>(
      this,
      encrypter,
      sequence
    );
    return new BlockCiphertextRecord(this.type, this.version, fragment);
  }

  async #encryptAeadOrThrow(encrypter: AEADEncrypter, sequence: bigint) {
    const fragment = await GenericAEADCipher.encryptOrThrow<T>(
      this,
      encrypter,
      sequence
    );
    return new AEADCiphertextRecord(this.type, this.version, fragment);
  }

  async encryptOrThrow(encrypter: Encrypter, sequence: bigint) {
    if (encrypter.cipher_type === 'block')
      return this.#encryptBlockOrThrow(encrypter, sequence);
    if (encrypter.cipher_type === 'aead')
      return this.#encryptAeadOrThrow(encrypter, sequence);

    throw new Error(`Invalid cipher type`);
  }
}

export class BlockCiphertextRecord {
  constructor(
    readonly type: number,
    readonly version: number,
    readonly fragment: GenericBlockCipher
  ) {}

  static fromOrThrow(record: PlaintextRecord<Opaque>) {
    const fragment = record.fragment.readIntoOrThrow(GenericBlockCipher);
    return new BlockCiphertextRecord(record.type, record.version, fragment);
  }

  sizeOrThrow() {
    return 1 + 2 + 2 + this.fragment.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.type);
    cursor.writeUint16OrThrow(this.version);

    const size = this.fragment.sizeOrThrow();
    cursor.writeUint16OrThrow(size);

    this.fragment.writeOrThrow(cursor);
  }

  async decryptOrThrow(encrypter: BlockEncrypter, sequence: bigint) {
    const fragment = await this.fragment.decryptOrThrow(
      this,
      encrypter,
      sequence
    );
    return new PlaintextRecord(this.type, this.version, fragment);
  }
}

export class AEADCiphertextRecord {
  constructor(
    readonly type: number,
    readonly version: number,
    readonly fragment: GenericAEADCipher
  ) {}

  static fromOrThrow(record: PlaintextRecord<Opaque>) {
    const fragment = record.fragment.readIntoOrThrow(GenericAEADCipher);
    return new AEADCiphertextRecord(record.type, record.version, fragment);
  }

  sizeOrThrow() {
    return 1 + 2 + 2 + this.fragment.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.type);
    cursor.writeUint16OrThrow(this.version);

    const size = this.fragment.sizeOrThrow();
    cursor.writeUint16OrThrow(size);

    this.fragment.writeOrThrow(cursor);
  }

  async decryptOrThrow(encrypter: AEADEncrypter, sequence: bigint) {
    const fragment = await this.fragment.decryptOrThrow(
      this,
      encrypter,
      sequence
    );
    return new PlaintextRecord(this.type, this.version, fragment);
  }
}
