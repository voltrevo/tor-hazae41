import { Aes128Ctr128BEKey } from '@hazae41/aes.wasm';
import type { Uint8Array } from '@hazae41/bytes';
import { SecretCircuit } from './circuit';
import { Sha1Hasher } from './Sha1Hasher';

export class Target {
  readonly #class = Target;

  delivery = 1000;
  package = 1000;

  digests = new Array<Uint8Array<20>>();

  constructor(
    readonly relayid_rsa: Uint8Array,
    readonly circuit: SecretCircuit,
    readonly forward_digest: Sha1Hasher,
    readonly backward_digest: Sha1Hasher,
    readonly forward_key: Aes128Ctr128BEKey,
    readonly backward_key: Aes128Ctr128BEKey
  ) {}
}
