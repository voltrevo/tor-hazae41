import { ReadableList } from '../../../../../mods/binary/lists/readable.js';
import { List } from '../../../../../mods/binary/lists/writable.js';
import { Number24 } from '../../../../../mods/binary/numbers/number24.js';
import { Handshake } from '../../../../../mods/binary/records/handshakes/handshake.js';
import { ReadableVector } from '../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../mods/binary/vectors/writable.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';
import { SafeUnknown } from '../../../../../../hazae41/binary/mods/binary/safe-unknown/mod.js';
import { Unknown } from '../../../../../../hazae41/binary/mod.js';

export class Certificate2 {
  readonly #class = Certificate2;

  static readonly handshake_type = Handshake.types.certificate;

  constructor(
    readonly certificate_list: Vector<Number24, List<Vector<Number24, Unknown>>>
  ) {}

  get handshake_type() {
    return this.#class.handshake_type;
  }

  sizeOrThrow() {
    return this.certificate_list.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    return this.certificate_list.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const opaque_vector24 = ReadableVector(Number24, SafeUnknown);
    const opaque_vector24_list = ReadableList(opaque_vector24);
    const opaque_vector_list_vector24 = ReadableVector(
      Number24,
      opaque_vector24_list
    );
    const certificate_list = opaque_vector_list_vector24.readOrThrow(cursor);

    return new Certificate2(certificate_list);
  }
}
