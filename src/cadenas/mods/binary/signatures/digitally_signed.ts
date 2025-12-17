import { Number16 } from '../../../mods/binary/numbers/number16.js';
import { SignatureAndHashAlgorithm } from '../../../mods/binary/signatures/signature_and_hash_algorithm.js';
import { ReadableVector } from '../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../mods/binary/vectors/writable.js';
import { Cursor } from '../../../../hazae41/cursor/mod.js';
import { Unknown } from '../../../../hazae41/binary/mod.js';
import { SafeUnknown } from '../../../../hazae41/binary/mods/binary/safe-unknown/mod.js';

export class DigitallySigned {
  constructor(
    readonly algorithm: SignatureAndHashAlgorithm,
    readonly signature: Vector<Number16, Unknown>
  ) {}

  sizeOrThrow() {
    return this.algorithm.sizeOrThrow() + this.signature.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.algorithm.writeOrThrow(cursor);
    this.signature.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const algorithm = SignatureAndHashAlgorithm.readOrThrow(cursor);
    const signature = ReadableVector(Number16, SafeUnknown).readOrThrow(cursor);

    return new DigitallySigned(algorithm, signature);
  }
}
