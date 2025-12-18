import { ClientKeyExchange2DH } from './client_key_exchange2_dh.js';
import { Cipher } from '../../../../ciphers/cipher.js';
import { DHE_RSA } from '../../../../ciphers/key_exchanges/dhe_rsa/dhe_rsa.js';
import { ECDHE_RSA } from '../../../../ciphers/key_exchanges/ecdhe_rsa/ecdhe_rsa.js';
import { ClientKeyExchange2ECDH } from './client_key_exchange2_ecdh.js';

export type ClientKeyExchange2 = ClientKeyExchange2DH | ClientKeyExchange2ECDH;

export type ReadableClientKeyExchange2 =
  | typeof ClientKeyExchange2DH
  | typeof ClientKeyExchange2ECDH;

export namespace ReadableClientKeyExchange2 {
  export function getOrThrow(cipher: Cipher): ReadableClientKeyExchange2 {
    if (cipher.key_exchange === DHE_RSA) return ClientKeyExchange2DH;
    if (cipher.key_exchange === ECDHE_RSA) return ClientKeyExchange2ECDH;

    throw new Error(`Invalid key exchange`);
  }
}
