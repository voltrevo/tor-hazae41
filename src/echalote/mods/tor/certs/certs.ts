import { X509 } from '@hazae41/x509';
import { Ed25519 } from '../../../../TorClient/WebCryptoEd25519.js';
import { assert } from '../../../../utils/assert.js';
import { RsaBigInt } from '../RsaBigInt.js';
import {
  CrossCert,
  Ed25519Cert,
  RsaCert,
  UnknownCertExtensionError,
} from '../index.js';
import { Bytes } from '../../../../hazae41/bytes/index.js';
import { Writable } from '../../../../hazae41/binary/mod.js';

export type CertError =
  | DuplicatedCertError
  | UnknownCertError
  | ExpectedCertError
  | ExpiredCertError
  | PrematureCertError
  | InvalidSignatureError
  | UnknownCertExtensionError
  | InvalidCertError;

export class DuplicatedCertError extends Error {
  readonly #class = DuplicatedCertError;
  readonly name = this.constructor.name;

  constructor() {
    super(`Duplicated certificate`);
  }
}

export class UnknownCertError extends Error {
  readonly #class = UnknownCertError;
  readonly name = this.constructor.name;

  constructor() {
    super(`Unknown certificate`);
  }
}

export class ExpectedCertError extends Error {
  readonly #class = ExpectedCertError;
  readonly name = this.constructor.name;

  constructor() {
    super(`Expected a certificate`);
  }
}

export class ExpiredCertError extends Error {
  readonly #class = ExpiredCertError;
  readonly name = this.constructor.name;

  constructor() {
    super(`Expired certificate`);
  }
}

export class PrematureCertError extends Error {
  readonly #class = PrematureCertError;
  readonly name = this.constructor.name;

  constructor() {
    super(`Premature certificate`);
  }
}

export class InvalidSignatureError extends Error {
  readonly #class = InvalidSignatureError;
  readonly name = this.constructor.name;

  constructor() {
    super(`Invalid certificate signature`);
  }
}

export class InvalidCertError extends Error {
  readonly #class = InvalidCertError;
  readonly name = this.constructor.name;

  constructor() {
    super(`Invalid certificate`);
  }
}

export interface Certs {
  readonly rsa_self: RsaCert;
  readonly rsa_to_tls?: RsaCert;
  readonly rsa_to_auth?: RsaCert;
  readonly rsa_to_ed: CrossCert;
  readonly ed_to_sign: Ed25519Cert;
  readonly sign_to_tls: Ed25519Cert;
  readonly sign_to_auth?: Ed25519Cert;
}

export namespace Certs {
  export async function verifyOrThrow(
    pcerts: Partial<Certs>,
    tlsCerts?: X509.Certificate[]
  ): Promise<Certs> {
    const { rsa_self, rsa_to_ed, ed_to_sign, sign_to_tls } = pcerts;

    if (tlsCerts == null) throw new ExpectedCertError();

    if (rsa_self == null) throw new ExpectedCertError();
    if (rsa_to_ed == null) throw new ExpectedCertError();
    if (ed_to_sign == null) throw new ExpectedCertError();
    if (sign_to_tls == null) throw new ExpectedCertError();

    const certs = { rsa_self, rsa_to_ed, ed_to_sign, sign_to_tls };

    const result = await Promise.all([
      verifyRsaSelfOrThrow(certs),
      verifyRsaToEdOrThrow(certs),
      verifyEdToSigningOrThrow(certs),
      verifySigningToTlsOrThrow(certs, tlsCerts),
    ]).then(all => all.every(x => x === true));

    assert(result === true, `Could not verify certs`);

    return certs;
  }

  async function verifyRsaSelfOrThrow(certs: Certs): Promise<true> {
    assert(
      certs.rsa_self.verifyOrThrow() === true,
      `Could not verify ID_SELF cert`
    );

    const length =
      certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey
        .bytes.length;

    /**
     * Only accept 1024-bits (128-bytes) public keys
     */
    if (length !== 12 + 128) throw new InvalidCertError();

    const signed = X509.writeToBytesOrThrow(certs.rsa_self.x509.tbsCertificate);
    const publicKey = X509.writeToBytesOrThrow(
      certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo
    );

    const signatureAlgorithm = {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    };
    const signature = certs.rsa_self.x509.signatureValue.bytes;

    const key = await crypto.subtle.importKey(
      'spki',
      publicKey,
      signatureAlgorithm,
      true,
      ['verify']
    );
    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature,
      signed
    );

    if (verified !== true) throw new InvalidSignatureError();

    /**
     * We don't verify the RSA identity on Snowflake / Meek
     */

    return true;
  }

  async function verifyRsaToEdOrThrow(certs: Certs): Promise<true> {
    assert(
      certs.rsa_to_ed.verifyOrThrow() === true,
      `Could not verify ID_TO_ED cert`
    );

    const publicKeyBytes = X509.writeToBytesOrThrow(
      certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo
    );

    const publicKeyMemory = new RsaBigInt.Memory(publicKeyBytes);
    const publicKeyPointer =
      RsaBigInt.RsaPublicKey.from_public_key_der(publicKeyMemory);

    const prefix = Bytes.fromUtf8('Tor TLS RSA/Ed25519 cross-certificate');
    const prefixed = Bytes.concat(prefix, certs.rsa_to_ed.payload);
    const hashed = Bytes.from(await crypto.subtle.digest('SHA-256', prefixed));

    const hashedMemory = new RsaBigInt.Memory(hashed);
    const signatureMemory = new RsaBigInt.Memory(certs.rsa_to_ed.signature);

    const verified = publicKeyPointer.verify_pkcs1v15_unprefixed(
      hashedMemory,
      signatureMemory
    );

    if (verified !== true) throw new InvalidSignatureError();

    /**
     * We don't verify the Ed25519 identity on Snowflake / Meek
     */

    return true;
  }

  async function verifyEdToSigningOrThrow(certs: Certs): Promise<true> {
    assert(
      (await certs.ed_to_sign.verifyOrThrow()) === true,
      `Could not verify ED_TO_SIGN cert`
    );

    const identity = await Ed25519.VerifyingKey.import(certs.rsa_to_ed.key);
    const signature = Ed25519.Signature.import(certs.ed_to_sign.signature);

    const verified = await identity.verify(certs.ed_to_sign.payload, signature);

    if (verified !== true) throw new InvalidSignatureError();

    return true;
  }

  async function verifySigningToTlsOrThrow(
    certs: Certs,
    tlsCerts: X509.Certificate[]
  ): Promise<true> {
    assert(
      (await certs.sign_to_tls.verifyOrThrow()) === true,
      `Could not verify SIGNING_TO_TLS cert`
    );

    const identity = await Ed25519.VerifyingKey.import(
      certs.ed_to_sign.certKey
    );
    const signature = Ed25519.Signature.import(certs.sign_to_tls.signature);

    const verified = await identity.verify(
      certs.sign_to_tls.payload,
      signature
    );

    if (verified !== true) throw new InvalidSignatureError();

    const tls = Writable.writeToBytesOrThrow(tlsCerts[0].toDER());
    const hash = Bytes.from(await crypto.subtle.digest('SHA-256', tls));

    if (Bytes.equals(hash, certs.sign_to_tls.certKey) !== true)
      throw new InvalidCertError();

    return true;
  }
}
