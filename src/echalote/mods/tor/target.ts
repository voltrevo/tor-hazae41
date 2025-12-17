import { Bytes } from '../../../hazae41/bytes';
import { WebCryptoAes128Ctr } from '../../../TorClient/WebCryptoAes128Ctr';
import { SecretCircuit } from './circuit';
import { Sha1Hasher } from './Sha1Hasher';

export class Target {
  readonly #class = Target;

  delivery = 1000;
  package = 1000;

  digests = new Array<Bytes<20>>();

  constructor(
    readonly relayid_rsa: Bytes,
    readonly circuit: SecretCircuit,
    readonly forward_digest: Sha1Hasher,
    readonly backward_digest: Sha1Hasher,
    readonly forward_key: WebCryptoAes128Ctr,
    readonly backward_key: WebCryptoAes128Ctr
  ) {}
}
