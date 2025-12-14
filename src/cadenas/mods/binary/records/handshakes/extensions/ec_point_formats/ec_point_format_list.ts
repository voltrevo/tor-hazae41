import { Cursor } from "@hazae41/cursor";
import { ReadableList } from "mods/binary/lists/readable.js";
import { List } from "mods/binary/lists/writable.js";
import { Number8 } from "mods/binary/numbers/number8.js";
import { ECPointFormat } from "mods/binary/records/handshakes/extensions/ec_point_formats/ec_point_format.js";
import { ReadableVector } from "mods/binary/vectors/readable.js";
import { Vector } from "mods/binary/vectors/writable.js";

export class ECPointFormatList {

  constructor(
    readonly ec_point_format_list: Vector<Number8, List<ECPointFormat>>
  ) { }

  static new(ec_point_format_list: Vector<Number8, List<ECPointFormat>>) {
    return new ECPointFormatList(ec_point_format_list)
  }

  static default() {
    const { uncompressed } = ECPointFormat.instances

    return this.from([uncompressed])
  }

  static from(ec_point_formats: ECPointFormat[]) {
    const ec_point_format_list = Vector(Number8).from(List.from(ec_point_formats))

    return new this(ec_point_format_list)
  }

  sizeOrThrow() {
    return this.ec_point_format_list.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    return this.ec_point_format_list.writeOrThrow(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    return new ECPointFormatList(ReadableVector(Number8, ReadableList(ECPointFormat)).readOrThrow(cursor))
  }

}