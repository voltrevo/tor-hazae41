import { Opaque, SafeOpaque } from '@hazae41/binary';
import { Number16 } from '../../../../../mods/binary/numbers/number16.js';
import { ReadableVector } from '../../../../../mods/binary/vectors/readable.js';
import { Extension } from './extension.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';

export namespace OpaqueExtension {
  export function readOrThrow(cursor: Cursor): Extension<Opaque> {
    const extension_type = cursor.readUint16OrThrow();
    const extension_data = ReadableVector(Number16, SafeOpaque).readOrThrow(
      cursor
    );

    return new Extension<Opaque>(extension_type, extension_data);
  }
}
