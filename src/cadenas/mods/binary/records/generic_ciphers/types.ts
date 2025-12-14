import { GenericAEADCipher } from "mods/binary/records/generic_ciphers/aead/aead.js"
import { GenericBlockCipher } from "mods/binary/records/generic_ciphers/block/block.js"

export type GenericCipher =
  | GenericBlockCipher
  | GenericAEADCipher
