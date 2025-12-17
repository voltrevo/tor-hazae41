import { Number16 } from '../../../../../mods/binary/numbers/number16.js';
import { ReadableVector } from '../../../../../mods/binary/vectors/readable.js';
import { Extension } from './extension.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';
import { SafeUnknown } from '../../../../../../hazae41/binary/mods/binary/safe-unknown/mod.js';
import { Unknown } from '../../../../../../hazae41/binary/mod.js';

export namespace OpaqueExtension {
  export function readOrThrow(cursor: Cursor): Extension<Unknown> {
    const extension_type = cursor.readUint16OrThrow();
    const extension_data = ReadableVector(Number16, SafeUnknown).readOrThrow(
      cursor
    );

    return new Extension<Unknown>(extension_type, extension_data);
  }
}
