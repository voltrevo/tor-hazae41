import { Number16 } from '../../../../../../mods/binary/numbers/number16.js';
import { ReadableVector } from '../../../../../../mods/binary/vectors/readable.js';
import { Vector } from '../../../../../../mods/binary/vectors/writable.js';
import { NameType } from './name_type.js';
import { Bytes } from '../../../../../../../hazae41/bytes/index.js';
import { Cursor } from '../../../../../../../hazae41/cursor/mod.js';
import { Unknown } from '../../../../../../../hazae41/binary/mod.js';
import { SafeUnknown } from '../../../../../../../hazae41/binary/mods/binary/safe-unknown/mod.js';

export class ServerName {
  constructor(
    readonly name_type: NameType,
    readonly host_name: Vector<Number16, Unknown>
  ) {}

  static new(name_type: NameType, host_name: Vector<Number16, Unknown>) {
    return new ServerName(name_type, host_name);
  }

  static from(host_name: string) {
    return new ServerName(
      NameType.instances.host_name,
      Vector(Number16).from(new Unknown(Bytes.fromAscii(host_name)))
    );
  }

  sizeOrThrow() {
    return this.name_type.sizeOrThrow() + this.host_name.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.name_type.writeOrThrow(cursor);
    this.host_name.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const name_type = NameType.readOrThrow(cursor);
    const host_name = ReadableVector(Number16, SafeUnknown).readOrThrow(cursor);

    return new ServerName(name_type, host_name);
  }
}
