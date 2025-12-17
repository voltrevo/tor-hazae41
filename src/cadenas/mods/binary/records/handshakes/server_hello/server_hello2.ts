import { Opaque, SafeOpaque } from '@hazae41/binary';
import { None, Option, Some } from '@hazae41/option';
import { ReadableList } from '../../../../../mods/binary/lists/readable.js';
import { List } from '../../../../../mods/binary/lists/writable.js';
import { Number16 } from '../../../../../mods/binary/numbers/number16.js';
import { Number8 } from '../../../../../mods/binary/numbers/number8.js';
import { Random } from '../../../../../mods/binary/random.js';
import { Extension } from '../../../../../mods/binary/records/handshakes/extensions/extension.js';
import { Handshake } from '../../../../../mods/binary/records/handshakes/handshake.js';
import { ReadableVector } from '../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../mods/binary/vectors/writable.js';
import { ResolvedExtension } from '../extensions/resolved.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';

export class ServerHello2 {
  static readonly type = Handshake.types.server_hello;

  constructor(
    readonly server_version: number,
    readonly random: Random,
    readonly session_id: Vector<Number8, Opaque>,
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
    const session_id = ReadableVector(Number8, SafeOpaque).readOrThrow(cursor);
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
