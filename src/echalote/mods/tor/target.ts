import { WebCryptoAes128Ctr } from '../../../TorClient/WebCryptoAes128Ctr';
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
    readonly forward_key: WebCryptoAes128Ctr,
    readonly backward_key: WebCryptoAes128Ctr
  ) {}
}
