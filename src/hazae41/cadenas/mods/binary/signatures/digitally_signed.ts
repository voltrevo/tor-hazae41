import { Number16 } from '../numbers/number16.js';
import { SignatureAndHashAlgorithm } from './signature_and_hash_algorithm.js';
import { ReadableVector } from '../vectors/readable.js';
import { Vector } from '../vectors/writable.js';
import { Cursor } from '../../../../cursor/mod.js';
import { Unknown } from '../../../../binary/mod.js';
import { SafeUnknown } from '../../../../binary/safe-unknown/mod.js';

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
