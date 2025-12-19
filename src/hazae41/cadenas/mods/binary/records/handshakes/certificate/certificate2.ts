import { ReadableList } from '../../../lists/readable.js';
import { List } from '../../../lists/writable.js';
import { Number24 } from '../../../numbers/number24.js';
import { Handshake } from '../handshake.js';
import { ReadableVector } from '../../../vectors/readable.js';
import { Vector } from '../../../vectors/writable.js';
import { Cursor } from '../../../../../../cursor/index.js';
import { Unknown } from '../../../../../../binary/mod.js';
import { SafeUnknown } from '../../../../../../binary/safe-unknown';

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
