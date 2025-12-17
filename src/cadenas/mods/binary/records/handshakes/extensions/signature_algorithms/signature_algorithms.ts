import { Cursor } from '../../../../../../../hazae41/cursor/mod.js';
import { ReadableList } from '../../../../../../mods/binary/lists/readable.js';
import { List } from '../../../../../../mods/binary/lists/writable.js';
import { Number16 } from '../../../../../../mods/binary/numbers/number16.js';
import { Extension } from '../../../../../../mods/binary/records/handshakes/extensions/extension.js';
import { SignatureAndHashAlgorithm } from '../../../../../../mods/binary/signatures/signature_and_hash_algorithm.js';
import { ReadableVector } from '../../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../../mods/binary/vectors/writable.js';

export class SignatureAlgorithms {
  readonly #class = SignatureAlgorithms;

  static readonly extension_type = Extension.types.signature_algorithms;

  constructor(
    readonly supported_signature_algorithms: Vector<
      Number16,
      List<SignatureAndHashAlgorithm>
    >
  ) {}

  static new(
    supported_signature_algorithms: Vector<
      Number16,
      List<SignatureAndHashAlgorithm>
    >
  ) {
    return new SignatureAlgorithms(supported_signature_algorithms);
  }

  static from(
    supported_signature_algorithms_list: SignatureAndHashAlgorithm[]
  ) {
    const supported_signature_algorithms = Vector(Number16).from(
      List.from(supported_signature_algorithms_list)
    );

    return new this(supported_signature_algorithms);
  }

  static default() {
    const {
      rsa_pkcs1_sha256,
      ecdsa_secp256r1_sha256,
      ed25519,
      ed448: _1,
    } = SignatureAndHashAlgorithm.instances;

    return this.from([rsa_pkcs1_sha256, ecdsa_secp256r1_sha256, ed25519]);
  }

  get extension_type() {
    return this.#class.extension_type;
  }

  sizeOrThrow() {
    return this.supported_signature_algorithms.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    return this.supported_signature_algorithms.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new SignatureAlgorithms(
      ReadableVector(
        Number16,
        ReadableList(SignatureAndHashAlgorithm)
      ).readOrThrow(cursor)
    );
  }
}
