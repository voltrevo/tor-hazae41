import { Base16 } from "../../../base16/index.ts";
import { Cursor } from "../../../cursor/mod.ts";
import { assert, test } from "../../../phobos/mod.ts";
import { Sequence } from "../triplets/sequence/sequence.ts";
import { Type } from "./type.ts";
import { relative, resolve } from "node:path";

const directory = resolve("./dist/test/")
const { pathname } = new URL(import.meta.url)
console.log(relative(directory, pathname.replace(".mjs", ".ts")))



function hexToType(hex: string) {
  const hex2 = hex.replaceAll(" ", "")
  const buffer = Base16.padStartAndDecodeOrThrow(hex2)
  return Type.DER.readOrThrow(new Cursor(buffer))
}

test("Read", async () => {
  assert(hexToType("30").equals(Sequence.DER.type))
})