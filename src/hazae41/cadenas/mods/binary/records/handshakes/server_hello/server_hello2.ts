import { None, Option, Some } from '../../../../../../option';
import { ReadableList } from '../../../lists/readable.js';
import { List } from '../../../lists/writable.js';
import { Number16 } from '../../../numbers/number16.js';
import { Number8 } from '../../../numbers/number8.js';
import { Random } from '../../../random.js';
import { Extension } from '../extensions/extension.js';
import { Handshake } from '../handshake.js';
import { ReadableVector } from '../../../vectors/readable.js';
import { Vector } from '../../../vectors/writable.js';
import { ResolvedExtension } from '../extensions/resolved.js';
import { Cursor } from '../../../../../../cursor/mod.js';
import { Unknown } from '../../../../../../binary/mod.js';
import { SafeUnknown } from '../../../../../../binary/safe-unknown/mod';

export class ServerHello2 {
  static readonly type = Handshake.types.server_hello;

  constructor(
    readonly server_version: number,
    readonly random: Random,
    readonly session_id: Vector<Number8, Unknown>,
    readonly cipher_suite: number,
    readonly compression_methods: Vector<Number8, List<Number8>>,
    readonly extensions: Option<
      Vector<Number16, List<Extension<ResolvedExtension>>>
    >
  ) {}

  sizeOrThrow() {
    return (
      0 +
      2 +
      this.random.sizeOrThrow() +
      this.session_id.sizeOrThrow() +
      2 +
      this.compression_methods.sizeOrThrow() +
      this.extensions.mapOrSync(0, x => x.sizeOrThrow())
    );
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint16OrThrow(this.server_version);
    this.random.writeOrThrow(cursor);
    this.session_id.writeOrThrow(cursor);
    cursor.writeUint16OrThrow(this.cipher_suite);
    this.compression_methods.writeOrThrow(cursor);
    this.extensions.mapSync(x => x.writeOrThrow(cursor));
  }

  static readOrThrow(cursor: Cursor) {
    const server_version = cursor.readUint16OrThrow();
    const random = Random.readOrThrow(cursor);
    const session_id = ReadableVector(Number8, SafeUnknown).readOrThrow(cursor);
    const cipher_suite = cursor.readUint16OrThrow();
    const compression_methods = ReadableVector(
      Number8,
      ReadableList(Number8)
    ).readOrThrow(cursor);

    const extensions =
      cursor.remaining > 0
        ? new Some(
            ReadableVector(
              Number16,
              ReadableList(ResolvedExtension)
            ).readOrThrow(cursor)
          )
        : new None();

    return new ServerHello2(
      server_version,
      random,
      session_id,
      cipher_suite,
      compression_methods,
      extensions
    );
  }
}
