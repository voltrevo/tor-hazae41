import { assert, test } from "../../../phobos/mod.ts"
import { getCryptoRandomOrNull } from "./index"

test("cryptoRandom", async ({ test }) => {
  const array = new Uint8Array([0, 1, 2, 3, 4, 5])
  const result = getCryptoRandomOrNull(array)!
  assert(array.includes(result))
})