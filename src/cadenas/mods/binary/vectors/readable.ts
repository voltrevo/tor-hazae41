import { Readable, Writable } from '@hazae41/binary';
import { NumberClass, NumberX } from '../../../mods/binary/numbers/number.js';
import { Vector } from '../../../mods/binary/vectors/writable.js';
import { Cursor } from '../../../../hazae41/cursor/mod.js';

export const ReadableVector = <L extends NumberX, W extends Writable>(
  $length: NumberClass<L>,
  $readable: Readable<W>
) =>
  class {
    static readOrThrow(cursor: Cursor): Vector<L, W> {
      const length = $length.readOrThrow(cursor).value;
      const bytes = cursor.readOrThrow(length);
      const value = Readable.readFromBytesOrThrow($readable, bytes);

      return new (Vector($length))(value);
    }
  };
