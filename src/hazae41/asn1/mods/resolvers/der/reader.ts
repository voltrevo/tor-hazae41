import { Cursor } from "../../../../cursor/mod.ts";
import { Opaque } from "../../triplets/opaque/opaque.ts";

export namespace DER {

  export function readOrThrow(cursor: Cursor) {
    return Opaque.DER.readOrThrow(cursor).resolveOrThrow()
  }

}