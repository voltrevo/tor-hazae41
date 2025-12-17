import { assert, test } from "../../../../phobos/mod.ts";
import { relative, resolve } from "path";
import { Validity } from "./validity";

const directory = resolve("./dist/test/")
const { pathname } = new URL(import.meta.url)
console.log(relative(directory, pathname.replace(".mjs", ".ts")))



test("Validity generation", async () => {
  const inOneDay = Validity.generate(1)

  assert(inOneDay.notAfter.value.getUTCDate() === inOneDay.notBefore.value.getUTCDate() + 1)

  const inOneYear = Validity.generate(365)

  assert(inOneYear.notAfter.value.getUTCFullYear() === inOneYear.notBefore.value.getUTCFullYear() + 1)
})