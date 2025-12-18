import { Number16 } from '../../../numbers/number16.js';
import { ReadableVector } from '../../../vectors/readable.js';
import { Extension } from './extension.js';
import { Cursor } from '../../../../../../cursor/mod.js';
import { Unknown } from '../../../../../../binary/mod.js';
import { SafeUnknown } from '../../../../../../binary/safe-unknown/mod.js';

export namespace OpaqueExtension {
  export function readOrThrow(cursor: Cursor): Extension<Unknown> {
    const extension_type = cursor.readUint16OrThrow();
    const extension_data = ReadableVector(Number16, SafeUnknown).readOrThrow(
      cursor
    );

    return new Extension<Unknown>(extension_type, extension_data);
  }
}
