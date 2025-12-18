import { Cipher } from './cipher.js';
import { AES_128_CBC } from './encryptions/aes_128_cbc/aes_128_cbc.js';
import { AES_128_GCM } from './encryptions/aes_128_gcm/aes_128_gcm.js';
import { AES_256_CBC } from './encryptions/aes_256_cbc/aes_256_cbc.js';
import { AES_256_GCM } from './encryptions/aes_256_gcm/aes_256_gcm.js';
import { SHA } from './hashes/sha/sha.js';
import { SHA256 } from './hashes/sha256/sha256.js';
import { SHA384 } from './hashes/sha384/sha384.js';
import { DHE_RSA } from './key_exchanges/dhe_rsa/dhe_rsa.js';
import { ECDHE_RSA } from './key_exchanges/ecdhe_rsa/ecdhe_rsa.js';
import { ECDHE_ECDSA } from './key_exchanges/index.js';

/**
 * Weak ciphers
 */
export const TLS_DHE_RSA_WITH_AES_128_CBC_SHA = new Cipher(
  0x0033,
  DHE_RSA,
  AES_128_CBC,
  SHA
);
export const TLS_DHE_RSA_WITH_AES_256_CBC_SHA = new Cipher(
  0x0039,
  DHE_RSA,
  AES_256_CBC,
  SHA
);

export const TLS_DHE_RSA_WITH_AES_128_CBC_SHA256 = new Cipher(
  0x0067,
  DHE_RSA,
  AES_128_CBC,
  SHA256
);
export const TLS_DHE_RSA_WITH_AES_256_CBC_SHA256 = new Cipher(
  0x006b,
  DHE_RSA,
  AES_256_CBC,
  SHA256
);

/**
 * Secure ciphers
 */
export const TLS_DHE_RSA_WITH_AES_128_GCM_SHA256 = new Cipher(
  0x009e,
  DHE_RSA,
  AES_128_GCM,
  SHA256
);
export const TLS_DHE_RSA_WITH_AES_256_GCM_SHA384 = new Cipher(
  0x009f,
  DHE_RSA,
  AES_256_GCM,
  SHA384
);

export const TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 = new Cipher(
  0xc030,
  ECDHE_RSA,
  AES_256_GCM,
  SHA384
);

/**
 * Strong ciphers
 */
export const TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384 = new Cipher(
  0xc02c,
  ECDHE_ECDSA,
  AES_256_GCM,
  SHA384
);
