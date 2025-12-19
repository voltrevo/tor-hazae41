import { List } from './writable.js';
import { Cursor } from '../../../../cursor/index.js';
import { Readable, Writable } from '../../../../binary/mod.js';

export const ReadableList = <W extends Writable>($readable: Readable<W>) =>
  class {
    static readOrThrow(cursor: Cursor): List<W> {
      const array = new Array<W>();

      while (cursor.remaining) array.push($readable.readOrThrow(cursor));

      return new List(array);
    }
  };
