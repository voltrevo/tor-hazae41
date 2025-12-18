import { NumberClass, NumberX } from '../numbers/number.js';
import { Vector } from './writable.js';
import { Cursor } from '../../../../cursor/mod.js';
import { Readable, Writable } from '../../../../binary/mod.js';

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
