import { Number16 } from '../../../../numbers/number16.js';
import { ReadableVector } from '../../../../vectors/readable.js';
import { Vector } from '../../../../vectors/writable.js';
import { NameType } from './name_type.js';
import { Bytes } from '../../../../../../../bytes/index.js';
import { Cursor } from '../../../../../../../cursor/index.js';
import { Unknown } from '../../../../../../../binary/mod.js';
import { SafeUnknown } from '../../../../../../../binary/safe-unknown';

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
