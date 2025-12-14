import { Base16 } from "@hazae41/base16";
import { BytesOrCopiable, Copiable } from "libs/copiable/index.js";

export namespace BigBytes {

  export function exportOrThrow(value: bigint) {
    return Copiable.copyAndDispose(Base16.get().getOrThrow().padStartAndDecodeOrThrow(value.toString(16)))
  }

  export function importOrThrow(bytes: BytesOrCopiable) {
    return BigInt("0x" + Base16.get().getOrThrow().encodeOrThrow(bytes))
  }

}