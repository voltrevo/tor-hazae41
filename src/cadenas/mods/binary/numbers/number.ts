import { Readable } from "@hazae41/binary"
import { Number16 } from "mods/binary/numbers/number16.js"
import { Number24 } from "mods/binary/numbers/number24.js"
import { Number8 } from "mods/binary/numbers/number8.js"

export type NumberX =
  | Number8
  | Number16
  | Number24

export interface NumberClass<T> extends Readable<T> {
  readonly size: number
  new(value: number): T
}
