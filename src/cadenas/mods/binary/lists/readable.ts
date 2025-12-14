import { Readable, Writable } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { List } from "mods/binary/lists/writable.js"

export const ReadableList = <W extends Writable>($readable: Readable<W>) => class {

  static readOrThrow(cursor: Cursor): List<W> {
    const array = new Array<W>()

    while (cursor.remaining)
      array.push($readable.readOrThrow(cursor))

    return new List(array)
  }

}