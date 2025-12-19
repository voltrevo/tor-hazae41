import { IA5String, Integer, ObjectIdentifier, Sequence } from '../../asn1';
import { Certificate, OtherName, SubjectAltName, X509 } from '../../x509';
import { BigintBytes } from '../../common/BigintBytes.js';
import { prfOrThrow } from './algorithms/prf/prf.js';
import { List } from './binary/lists/writable.js';
import { Number24 } from './binary/numbers/number24.js';
import { Alert } from './binary/records/alerts/alert.js';
import { ChangeCipherSpec } from './binary/records/change_cipher_spec/change_cipher_spec.js';
import { Certificate2 } from './binary/records/handshakes/certificate/certificate2.js';
import { CertificateRequest2 } from './binary/records/handshakes/certificate_request/certificate_request2.js';
import { ClientHello2 } from './binary/records/handshakes/client_hello/client_hello2.js';
import { ClientKeyExchange2DH } from './binary/records/handshakes/client_key_exchange/client_key_exchange2_dh.js';
import { ClientKeyExchange2ECDH } from './binary/records/handshakes/client_key_exchange/client_key_exchange2_ecdh.js';
import { NamedCurve } from './binary/records/handshakes/extensions/elliptic_curves/named_curve.js';
import { Finished2 } from './binary/records/handshakes/finished/finished2.js';
import { Handshake } from './binary/records/handshakes/handshake.js';
import { ServerHello2 } from './binary/records/handshakes/server_hello/server_hello2.js';
import { ServerHelloDone2 } from './binary/records/handshakes/server_hello_done/server_hello_done2.js';
import { ServerDHParams } from './binary/records/handshakes/server_key_exchange/server_dh_params.js';
import { ServerECDHParams } from './binary/records/handshakes/server_key_exchange/server_ecdh_params.js';
import { ReadableServerKeyExchange2 } from './binary/records/handshakes/server_key_exchange/server_key_exchange2.js';
import { ServerKeyExchange2DHSigned } from './binary/records/handshakes/server_key_exchange/server_key_exchange2_dh_signed.js';
import {
  ServerKeyExchange2ECDHPreSigned,
  ServerKeyExchange2ECDHSigned,
} from './binary/records/handshakes/server_key_exchange/server_key_exchange2_ecdh_signed.js';
import {
  AEADCiphertextRecord,
  BlockCiphertextRecord,
  PlaintextRecord,
  Record,
} from './binary/records/record.js';
import { HashAlgorithm } from './binary/signatures/hash_algorithm.js';
import { SignatureAlgorithm } from './binary/signatures/signature_algorithm.js';
import { Vector } from './binary/vectors/writable.js';
import { Cipher } from './ciphers/cipher.js';
import { Secp256r1 } from './ciphers/curves/secp256r1.js';
import { Encrypter } from './ciphers/encryptions/encryption.js';
import { Secrets } from './ciphers/secrets.js';
import { TlsClientDuplex } from './client.js';
import { Console } from './console/index.js';
import {
  FatalAlertError,
  InvalidTlsStateError,
  UnsupportedCipherError,
  UnsupportedVersionError,
  WarningAlertError,
} from './errors.js';
import { Extensions } from './extensions.js';
import { App } from '../../../TorClient/App.js';
import { CCADB } from './ccadb/CCADB.js';
import { Bytes } from '../../bytes/index.js';
import { Cursor } from '../../cursor/index.js';
import { Readable, Unknown, Writable } from '../../binary/mod.js';
import { bigModularExponent } from '../../common/bigModularExponent';

export type TlsClientState =
  | TlsClientNoneState
  | TlsClientHandshakeClientHelloState
  | TlsClientHandshakeServerHelloState
  | TlsClientHandshakeClientFinishedState
  | TlsClientHandshakeServerCipheredState
  | TlsClientHandshakedState;

async function onAlert(
  state: TlsClientState,
  record: PlaintextRecord<Unknown>
) {
  const alert = record.fragment.readIntoOrThrow(Alert);

  Console.debug(alert);

  if (alert.level === Alert.levels.fatal) throw new FatalAlertError(alert);

  if (alert.description === Alert.descriptions.close_notify)
    return state.client.input.close();

  if (alert.level === Alert.levels.warning)
    return console.warn(new WarningAlertError(alert));

  console.warn(`Unknown alert level ${alert.level}`);
}

export class TlsClientNoneState {
  readonly type = 'none';

  readonly client_encrypted = false;
  readonly server_encrypted = false;

  constructor(
    readonly app: App,
    readonly client: TlsClientDuplex
  ) {}

  async onOutputStart() {
    const client_hello = ClientHello2.default(
      this.client.params.ciphers,
      this.client.params.host_name
    );

    Console.debug(client_hello);

    const client_random = Writable.writeToBytesOrThrow(
      client_hello.random
    ) as Bytes<32>;
    const client_extensions = Extensions.getClientExtensions(client_hello);

    const client_hello_handshake = Handshake.from(client_hello);

    this.client.state = new TlsClientHandshakeClientHelloState(
      this.app,
      this.client,
      {
        client_random,
        client_extensions,
      }
    );

    this.client.state.messages.push(
      Writable.writeToBytesOrThrow(client_hello_handshake)
    );

    const client_hello_handshake_record = PlaintextRecord.from(
      client_hello_handshake,
      0x0301
    );

    this.client.output.enqueue(client_hello_handshake_record);

    const rejectOnClose = this.client.resolveOnClose.promise.then(() => {
      throw new Error('Closed');
    });
    const rejectOnError = this.client.resolveOnError.promise.then(cause => {
      throw new Error('Errored', { cause });
    });

    await Promise.race([
      this.client.resolveOnHandshake.promise,
      rejectOnClose,
      rejectOnError,
    ]);
  }

  async onOutputWrite(_chunk: Writable) {
    throw new InvalidTlsStateError();
  }

  async onRecord(_record: PlaintextRecord<Unknown>) {
    throw new InvalidTlsStateError();
  }
}

export type TlsClientHandshakeState =
  | TlsClientHandshakeClientHelloState
  | TlsClientHandshakeServerHelloState
  | TlsClientHandshakeClientFinishedState;

export interface TlsClientHandshakeClientHelloStateParams {
  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;
}

export class TlsClientHandshakeClientHelloState implements TlsClientHandshakeClientHelloStateParams {
  readonly type = 'handshake';
  readonly step = 'client_hello';

  readonly client_encrypted = false;
  readonly server_encrypted = false;

  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;

  readonly messages = new Array<Bytes>();

  constructor(
    readonly app: App,
    readonly client: TlsClientDuplex,
    readonly params: TlsClientHandshakeClientHelloStateParams
  ) {
    this.client_random = params.client_random;
    this.client_extensions = params.client_extensions;
  }

  async onOutputStart() {
    throw new InvalidTlsStateError();
  }

  async onOutputWrite(_chunk: Writable) {
    throw new InvalidTlsStateError();
  }

  async onRecord(record: PlaintextRecord<Unknown>) {
    await this.onPlaintextRecord(record);
  }

  async onPlaintextRecord(record: PlaintextRecord<Unknown>) {
    if (record.type === Alert.record_type) return await onAlert(this, record);
    if (record.type === Record.types.handshake)
      return await this.onHandshake(record);
    throw new InvalidTlsStateError();
  }

  async onHandshake(record: PlaintextRecord<Unknown>) {
    const handshake = record.fragment.readIntoOrThrow(Handshake);

    if (handshake.type !== Handshake.types.hello_request)
      this.messages.push(Bytes.from(record.fragment.bytes));

    if (handshake.type === ServerHello2.type)
      return this.onServerHello(handshake);

    console.warn(handshake);
  }

  async onServerHello(handshake: Handshake<Unknown>) {
    const server_hello = handshake.fragment.readIntoOrThrow(ServerHello2);

    Console.debug(server_hello);

    const version = server_hello.server_version;

    if (version !== 0x0303) throw new UnsupportedVersionError(version);

    const cipher = this.client.params.ciphers.find(
      it => it.id === server_hello.cipher_suite
    );

    if (cipher === undefined)
      throw new UnsupportedCipherError(server_hello.cipher_suite);

    const server_random = Writable.writeToBytesOrThrow(
      server_hello.random
    ) as Bytes<32>;
    const server_extensions = Extensions.getServerExtensions(
      server_hello,
      this.client_extensions
    );

    Console.debug(server_extensions);

    const { client_random, client_extensions, messages } = this;
    this.client.state = new TlsClientHandshakeServerHelloState(
      this.app,
      this.client,
      {
        version,
        cipher,
        client_random,
        client_extensions,
        server_random,
        server_extensions,
        messages,
      }
    );
  }
}

export interface TlsClientHandshakeServerHelloStateParams {
  readonly version: number;
  readonly cipher: Cipher;

  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;

  readonly server_random: Bytes<32>;
  readonly server_extensions: Extensions;

  readonly messages: Bytes[];
}

export class TlsClientHandshakeServerHelloState implements TlsClientHandshakeServerHelloStateParams {
  readonly type = 'handshake';
  readonly step = 'server_hello';

  readonly client_encrypted = false;
  readonly server_encrypted = false;

  readonly version: number;
  readonly cipher: Cipher;

  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;

  readonly server_random: Bytes<32>;
  readonly server_extensions: Extensions;

  readonly messages: Bytes[];

  readonly ccadb: CCADB;

  certificate_request?: CertificateRequest2;

  server_certificates?: readonly Certificate[];

  server_dh_params?: ServerDHParams;
  server_ecdh_params?: ServerECDHParams;

  constructor(
    readonly app: App,
    readonly client: TlsClientDuplex,
    readonly params: TlsClientHandshakeServerHelloStateParams
  ) {
    this.version = params.version;
    this.cipher = params.cipher;

    this.client_random = params.client_random;
    this.client_extensions = params.client_extensions;

    this.server_random = params.server_random;
    this.server_extensions = params.server_extensions;

    this.messages = params.messages;

    this.ccadb = app.get('ccadb');
  }

  async onOutputStart() {
    throw new InvalidTlsStateError();
  }

  async onOutputWrite(_chunk: Writable) {
    throw new InvalidTlsStateError();
  }

  async onRecord(record: PlaintextRecord<Unknown>) {
    await this.onPlaintextRecord(record);
  }

  async onPlaintextRecord(record: PlaintextRecord<Unknown>) {
    if (record.type === Alert.record_type) return await onAlert(this, record);
    if (record.type === Record.types.handshake)
      return await this.onHandshake(record);
    throw new InvalidTlsStateError();
  }

  async onHandshake(record: PlaintextRecord<Unknown>) {
    const handshake = record.fragment.readIntoOrThrow(Handshake);

    if (handshake.type !== Handshake.types.hello_request)
      this.messages.push(Bytes.from(record.fragment.bytes));

    if (handshake.type === Certificate2.handshake_type)
      return await this.onCertificate(handshake);
    if (handshake.type === Handshake.types.server_key_exchange)
      return this.onServerKeyExchange(handshake);
    if (handshake.type === CertificateRequest2.type)
      return this.onCertificateRequest(handshake);
    if (handshake.type === ServerHelloDone2.type)
      return this.onServerHelloDone(handshake);

    console.warn(handshake);
  }

  #verifyHostNameOrThrow(certificate: X509.Certificate) {
    const { host_name } = this.client.params;

    /**
     * Do not check if no host name is provided
     */
    if (host_name == null) return true;

    if (certificate.tbsCertificate.extensions == null)
      throw new Error('Could not verify domain name');

    for (const extension of certificate.tbsCertificate.extensions.extensions) {
      if (extension.extnID.value === '2.5.29.17' /* subjectAltName */) {
        const subjectAltName = extension.extnValue as SubjectAltName;

        for (const name of subjectAltName.inner.names) {
          if (name instanceof OtherName) continue;
          if (name instanceof IA5String) {
            /**
             * Verify exact match
             */
            if (name.value === host_name) return true;

            /**
             * Verify with wildcards
             */

            const self: string[] = host_name.split('.');
            const other: string[] = name.value.split('.');

            if (self.length !== other.length) continue;

            const unstarred = other
              .map((x, i) => {
                if (x === '*') return self[i];
                return x;
              })
              .join('.');

            if (unstarred === host_name) return true;
            continue;
          }
        }
      }
    }

    throw new Error('Could not verify domain name');
  }

  async onCertificate(handshake: Handshake<Unknown>) {
    const certificate = handshake.fragment.readIntoOrThrow(Certificate2);

    Console.debug(certificate);

    const server_certificates = certificate.certificate_list.value.array.map(
      it =>
        X509.readAndResolveFromBytesOrThrow(X509.Certificate, it.value.bytes)
    );

    const now = new Date();

    if (server_certificates.length === 0) throw new Error(`Empty certificates`);

    /**
     * Verify host name
     */
    if (this.#verifyHostNameOrThrow(server_certificates[0]) !== true)
      throw new Error('Could not verify domain name');

    let authorized = this.client.params.authorized;

    /**
     * Verify certificate chain
     */
    for (
      let i = 0;
      authorized !== true && i < server_certificates.length;
      i++
    ) {
      const current = server_certificates[i];

      if (now > current.tbsCertificate.validity.notAfter.value)
        throw new Error(`Certificate is expired`);
      if (now < current.tbsCertificate.validity.notBefore.value)
        throw new Error(`Certificate is not yet valid`);

      const issuer = current.tbsCertificate.issuer.toX501OrThrow();

      let next = server_certificates.at(i + 1);

      if (next == null) {
        const trusteds = await this.ccadb.get();
        const trusted = trusteds[issuer];

        if (trusted == null) continue;

        const raw = Bytes.fromHexAllowMissing0(trusted.certBase16);
        const x509 = X509.readAndResolveFromBytesOrThrow(X509.Certificate, raw);

        next = x509;
      }

      const subject = next.tbsCertificate.subject.toX501OrThrow();

      if (issuer !== subject) throw new Error(`Invalid certificate chain`);

      const identitySpki = next.tbsCertificate.subjectPublicKeyInfo;
      const identityBytes = Writable.writeToBytesOrThrow(identitySpki.toDER());
      const identityHash = Bytes.from(
        await crypto.subtle.digest('SHA-256', identityBytes)
      );

      let verified = false;

      if (
        current.algorithmIdentifier.algorithm.value ===
        '1.2.840.113549.1.1.11' /* sha256WithRSAEncryption */
      ) {
        const identityAlgorithm = {
          name: 'RSASSA-PKCS1-v1_5',
          hash: { name: 'SHA-256' },
        };
        const identityKey = await crypto.subtle.importKey(
          'spki',
          identityBytes,
          identityAlgorithm,
          false,
          ['verify']
        );

        const dataBytes = Writable.writeToBytesOrThrow(
          current.tbsCertificate.toDER()
        );

        const signatureAlgorithm = 'RSASSA-PKCS1-v1_5';
        const signatureBytes = current.signatureValue.bytes;

        verified = await crypto.subtle.verify(
          signatureAlgorithm,
          identityKey,
          signatureBytes,
          dataBytes
        );
      } else if (
        current.algorithmIdentifier.algorithm.value ===
        '1.2.840.10045.4.3.2' /* ecdsaWithSHA256 */
      ) {
        if (
          identitySpki.algorithm.algorithm.value !==
          '1.2.840.10045.2.1' /* ecPublicKey */
        )
          throw new Error(
            `Invalid public key algorithm ${identitySpki.algorithm.algorithm.value}`
          );
        if (!(identitySpki.algorithm.parameters instanceof ObjectIdentifier))
          throw new Error(
            `Invalid public key parameters ${identitySpki.algorithm.parameters}`
          );

        if (
          identitySpki.algorithm.parameters.value ===
          '1.2.840.10045.3.1.7' /* secp256r1 */
        ) {
          const identityAlgorithm = { name: 'ECDSA', namedCurve: 'P-256' };
          const identityKey = await crypto.subtle.importKey(
            'spki',
            identityBytes,
            identityAlgorithm,
            false,
            ['verify']
          );

          const dataBytes = Writable.writeToBytesOrThrow(
            current.tbsCertificate.toDER()
          );

          const signatureAlgorithm = {
            name: 'ECDSA',
            hash: { name: 'SHA-256' },
          };
          const signatureBytes = current.signatureValue.bytes;
          const signatureAsn1 = Readable.readFromBytesOrThrow(
            Sequence.DER,
            signatureBytes
          );

          const rAsn1 = signatureAsn1.triplets[0].readIntoOrThrow(Integer.DER);
          const sAsn1 = signatureAsn1.triplets[1].readIntoOrThrow(Integer.DER);

          const rAndS = new Cursor(Bytes.alloc(32 * 2));
          rAndS.writeOrThrow(BigintBytes.toBytes(rAsn1.value));
          rAndS.writeOrThrow(BigintBytes.toBytes(sAsn1.value));

          verified = await crypto.subtle.verify(
            signatureAlgorithm,
            identityKey,
            rAndS.bytes,
            dataBytes
          );
        }
      } else if (
        current.algorithmIdentifier.algorithm.value ===
        '1.2.840.10045.4.3.3' /* ecdsaWithSHA384 */
      ) {
        if (
          identitySpki.algorithm.algorithm.value !==
          '1.2.840.10045.2.1' /* ecPublicKey */
        )
          throw new Error(
            `Invalid public key algorithm ${identitySpki.algorithm.algorithm.value}`
          );
        if (!(identitySpki.algorithm.parameters instanceof ObjectIdentifier))
          throw new Error(
            `Invalid public key parameters ${identitySpki.algorithm.parameters}`
          );

        if (
          identitySpki.algorithm.parameters.value ===
          '1.3.132.0.34' /* secp384r1 */
        ) {
          const identityAlgorithm = { name: 'ECDSA', namedCurve: 'P-384' };
          const identityKey = await crypto.subtle.importKey(
            'spki',
            identityBytes,
            identityAlgorithm,
            false,
            ['verify']
          );

          const dataBytes = Writable.writeToBytesOrThrow(
            current.tbsCertificate.toDER()
          );

          const signatureAlgorithm = {
            name: 'ECDSA',
            hash: { name: 'SHA-384' },
          };
          const signatureBytes = current.signatureValue.bytes;
          const signatureAsn1 = Readable.readFromBytesOrThrow(
            Sequence.DER,
            signatureBytes
          );

          const rAsn1 = signatureAsn1.triplets[0].readIntoOrThrow(Integer.DER);
          const sAsn1 = signatureAsn1.triplets[1].readIntoOrThrow(Integer.DER);

          const rAndS = new Cursor(Bytes.alloc(48 * 2));
          rAndS.writeOrThrow(BigintBytes.toBytes(rAsn1.value));
          rAndS.writeOrThrow(BigintBytes.toBytes(sAsn1.value));

          verified = await crypto.subtle.verify(
            signatureAlgorithm,
            identityKey,
            rAndS.bytes,
            dataBytes
          );
        }
      }

      if (!verified) throw new Error(`Invalid signature`);

      const trusteds = await this.ccadb.get();
      const trusted = trusteds[issuer];

      if (trusted == null) continue;

      const { notAfter } = trusted;

      if (notAfter && now > new Date(notAfter)) continue;

      const trustedIdentityHash = Bytes.fromHexAllowMissing0(
        trusted.hashBase16
      );

      if (!Bytes.equals(identityHash, trustedIdentityHash)) continue;

      /**
       * This certificate was signed by a trusted identity
       */
      authorized = true;
      break;
    }

    if (authorized !== true)
      throw new Error(`Could not verify certificate chain`);

    await this.client.params.certificates?.call(
      this.client,
      server_certificates
    );

    this.server_certificates = server_certificates;
  }

  async onServerKeyExchange(handshake: Handshake<Unknown>) {
    const clazz = ReadableServerKeyExchange2.getOrThrow(this.cipher);

    const server_key_exchange = handshake.fragment.readIntoOrThrow(clazz);

    if (server_key_exchange instanceof ServerKeyExchange2DHSigned) {
      Console.debug(server_key_exchange);

      const { params } = server_key_exchange;

      console.warn('Could not verify key exchange');

      this.server_dh_params = params;

      return;
    }

    if (server_key_exchange instanceof ServerKeyExchange2ECDHSigned) {
      Console.debug(server_key_exchange);

      if (this.server_certificates == null) throw new InvalidTlsStateError();

      const { params, signed_params } = server_key_exchange;

      if (
        signed_params.algorithm.signature.type === SignatureAlgorithm.types.rsa
      ) {
        if (signed_params.algorithm.hash.type !== HashAlgorithm.types.sha256)
          throw new Error(
            `Unsupported hash algorithm ${signed_params.algorithm.hash.type}`
          );

        const identitySpki = X509.writeToBytesOrThrow(
          this.server_certificates[0].tbsCertificate.subjectPublicKeyInfo
        );
        const identityAlgorithm = {
          name: 'RSASSA-PKCS1-v1_5',
          hash: { name: 'SHA-256' },
        };
        const identityKey = await crypto.subtle.importKey(
          'spki',
          identitySpki,
          identityAlgorithm,
          false,
          ['verify']
        );

        const dataStruct = new ServerKeyExchange2ECDHPreSigned(
          this.client_random,
          this.server_random,
          params
        );
        const dataBytes = Writable.writeToBytesOrThrow(dataStruct);

        const signatureAlgorithm = 'RSASSA-PKCS1-v1_5';
        const signatureBytes = signed_params.signature.value.bytes;

        const verified = await crypto.subtle.verify(
          signatureAlgorithm,
          identityKey,
          signatureBytes,
          dataBytes
        );

        if (verified !== true) throw new Error(`Invalid signature`);

        this.server_ecdh_params = params;

        return;
      }

      if (
        signed_params.algorithm.signature.type ===
        SignatureAlgorithm.types.ecdsa
      ) {
        if (signed_params.algorithm.hash.type !== HashAlgorithm.types.sha256)
          throw new Error(
            `Unsupported hash algorithm ${signed_params.algorithm.hash.type}`
          );

        const identitySpki = X509.writeToBytesOrThrow(
          this.server_certificates[0].tbsCertificate.subjectPublicKeyInfo
        );
        const identityAlgorithm = { name: 'ECDSA', namedCurve: 'P-256' };
        const identityKey = await crypto.subtle.importKey(
          'spki',
          identitySpki,
          identityAlgorithm,
          false,
          ['verify']
        );

        const dataStruct = new ServerKeyExchange2ECDHPreSigned(
          this.client_random,
          this.server_random,
          params
        );
        const dataBytes = Writable.writeToBytesOrThrow(dataStruct);

        const signatureAlgorithm = { name: 'ECDSA', hash: { name: 'SHA-256' } };
        const signatureBytes = signed_params.signature.value.bytes;
        const signatureAsn1 = Readable.readFromBytesOrThrow(
          Sequence.DER,
          signatureBytes
        );

        const rAsn1 = signatureAsn1.triplets[0].readIntoOrThrow(Integer.DER);
        const sAsn1 = signatureAsn1.triplets[1].readIntoOrThrow(Integer.DER);

        const rAndS = new Cursor(Bytes.alloc(32 * 2));
        rAndS.writeOrThrow(BigintBytes.toBytes(rAsn1.value));
        rAndS.writeOrThrow(BigintBytes.toBytes(sAsn1.value));

        const verified = await crypto.subtle.verify(
          signatureAlgorithm,
          identityKey,
          rAndS.bytes,
          dataBytes
        );

        if (verified !== true) throw new Error(`Invalid signature`);

        this.server_ecdh_params = params;

        return;
      }

      throw new Error(
        `Unsupported signature algorithm ${signed_params.algorithm.signature.type}`
      );
    }

    console.warn(server_key_exchange);
  }

  async onCertificateRequest(handshake: Handshake<Unknown>) {
    const certificate_request =
      handshake.fragment.readIntoOrThrow(CertificateRequest2);

    Console.debug(certificate_request);

    this.certificate_request = certificate_request;
  }

  #computeDhOrThrow(params: ServerDHParams): {
    dh_Yc: Bytes;
    dh_Z: Bytes;
  } {
    const { dh_g, dh_p, dh_Ys } = params;

    const g = BigintBytes.fromBytes(dh_g.value.bytes);
    const p = BigintBytes.fromBytes(dh_p.value.bytes);
    const Ys = BigintBytes.fromBytes(dh_Ys.value.bytes);

    const dh_yc = crypto.getRandomValues(Bytes.alloc(dh_p.value.bytes.length));

    const yc = BigintBytes.fromBytes(dh_yc);

    const Yc = bigModularExponent(g, yc, p);
    const Z = bigModularExponent(Ys, yc, p);

    const dh_Yc = BigintBytes.toBytes(Yc);
    const dh_Z = BigintBytes.toBytes(Z);

    return { dh_Yc, dh_Z };
  }

  async #computeEcDhOrThrow(params: ServerECDHParams) {
    if (params.curve_params.named_curve.value === NamedCurve.types.secp256r1)
      return new Secp256r1().computeOrThrow(params);

    throw new InvalidTlsStateError();
  }

  async #computeSecretsOrThrow(premaster_secret: Bytes): Promise<Secrets> {
    const { cipher, client_random, server_random } = this;
    const { prf_md } = cipher.hash;

    // Console.debug("premaster_secret", premaster_secret.length, Bytes.toHex(premaster_secret))

    const master_secret_seed = Bytes.concat(client_random, server_random);
    const master_secret = await prfOrThrow(
      prf_md,
      premaster_secret,
      'master secret',
      master_secret_seed,
      48
    );
    // Console.debug("master_secret", master_secret.length, Bytes.toHex(master_secret))

    const key_block_length =
      0 +
      2 * cipher.hash.mac_key_length +
      2 * cipher.encryption.enc_key_length +
      2 * cipher.encryption.fixed_iv_length;

    const key_block_seed = Bytes.concat(server_random, client_random);
    const key_block = await prfOrThrow(
      prf_md,
      master_secret,
      'key expansion',
      key_block_seed,
      key_block_length
    );

    // Console.debug("key_block", key_block.length, Bytes.toHex(key_block))

    const key_block_cursor = new Cursor(key_block);

    const mac_key_length =
      cipher.encryption.cipher_type === 'block'
        ? cipher.hash.mac.mac_key_length
        : 0;

    const client_write_MAC_key =
      key_block_cursor.readAndCopyOrThrow(mac_key_length);
    const server_write_MAC_key =
      key_block_cursor.readAndCopyOrThrow(mac_key_length);

    // Console.debug("client_write_MAC_key", client_write_MAC_key.length, Bytes.toHex(client_write_MAC_key))
    // Console.debug("server_write_MAC_key", server_write_MAC_key.length, Bytes.toHex(server_write_MAC_key))

    const client_write_key = key_block_cursor.readAndCopyOrThrow(
      cipher.encryption.enc_key_length
    );
    const server_write_key = key_block_cursor.readAndCopyOrThrow(
      cipher.encryption.enc_key_length
    );

    // Console.debug("client_write_key", client_write_key.length, Bytes.toHex(client_write_key))
    // Console.debug("server_write_key", server_write_key.length, Bytes.toHex(server_write_key))

    const client_write_IV = key_block_cursor.readAndCopyOrThrow(
      cipher.encryption.fixed_iv_length
    );
    const server_write_IV = key_block_cursor.readAndCopyOrThrow(
      cipher.encryption.fixed_iv_length
    );

    // Console.debug("client_write_IV", client_write_IV.length, Bytes.toHex(client_write_IV))
    // Console.debug("server_write_IV", server_write_IV.length, Bytes.toHex(server_write_IV))

    return {
      master_secret,
      client_write_MAC_key,
      server_write_MAC_key,
      client_write_key,
      server_write_key,
      client_write_IV,
      server_write_IV,
    };
  }

  async onServerHelloDone(handshake: Handshake<Unknown>) {
    const server_hello_done =
      handshake.fragment.readIntoOrThrow(ServerHelloDone2);

    Console.debug(server_hello_done);

    if (this.certificate_request != null) {
      const certificate_list = Vector(Number24).from(
        List.from<Vector<Number24, Unknown>>([])
      );

      const certificate = new Certificate2(certificate_list);
      const handshake_certificate = Handshake.from(certificate);
      const record_certificate = PlaintextRecord.from(
        handshake_certificate,
        this.version
      );

      this.messages.push(Writable.writeToBytesOrThrow(handshake_certificate));

      this.client.output.enqueue(record_certificate);
    }

    let secrets: Secrets;

    if (this.server_dh_params != null) {
      const { dh_Yc, dh_Z } = this.#computeDhOrThrow(this.server_dh_params);

      const handshake_client_key_exchange = Handshake.from(
        ClientKeyExchange2DH.from(dh_Yc)
      );
      const record_client_key_exchange = PlaintextRecord.from(
        handshake_client_key_exchange,
        this.version
      );

      this.messages.push(
        Writable.writeToBytesOrThrow(handshake_client_key_exchange)
      );

      this.client.output.enqueue(record_client_key_exchange);

      secrets = await this.#computeSecretsOrThrow(dh_Z);
    } else if (this.server_ecdh_params != null) {
      const { ecdh_Yc, ecdh_Z } = await this.#computeEcDhOrThrow(
        this.server_ecdh_params
      );

      const handshake_client_key_exchange = Handshake.from(
        ClientKeyExchange2ECDH.from(ecdh_Yc)
      );
      const record_client_key_exchange = PlaintextRecord.from(
        handshake_client_key_exchange,
        this.version
      );

      this.messages.push(
        Writable.writeToBytesOrThrow(handshake_client_key_exchange)
      );

      this.client.output.enqueue(record_client_key_exchange);

      secrets = await this.#computeSecretsOrThrow(ecdh_Z);
    } else throw new InvalidTlsStateError();

    let client_sequence = 0n;
    const server_sequence = 0n;

    const encrypter = await this.cipher.initOrThrow(secrets);

    const change_cipher_spec = new ChangeCipherSpec();
    const record_change_cipher_spec = PlaintextRecord.from(
      change_cipher_spec,
      this.version
    );

    this.client.output.enqueue(record_change_cipher_spec);

    const { handshake_md, prf_md } = this.cipher.hash;

    const handshake_messages = Bytes.concat(...this.messages);
    const handshake_messages_hash = Bytes.from(
      await crypto.subtle.digest(handshake_md, handshake_messages)
    );

    const verify_data = await prfOrThrow(
      prf_md,
      secrets.master_secret,
      'client finished',
      handshake_messages_hash,
      12
    );
    const finished = PlaintextRecord.from(
      Handshake.from(new Finished2(verify_data)),
      this.version
    );
    const cfinished = await finished.encryptOrThrow(
      encrypter,
      client_sequence++
    );

    this.client.output.enqueue(cfinished);

    const {
      version,
      cipher,
      client_random,
      client_extensions,
      server_random,
      server_extensions,
      messages,
    } = this;
    this.client.state = new TlsClientHandshakeClientFinishedState(this.client, {
      version,
      cipher,
      client_random,
      client_extensions,
      server_random,
      server_extensions,
      client_sequence,
      server_sequence,
      encrypter,
      messages,
    });
  }
}

export interface TlsClientHandshakeClientFinishedStateParams {
  readonly version: number;
  readonly cipher: Cipher;

  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;

  readonly server_random: Bytes<32>;
  readonly server_extensions: Extensions;

  readonly client_sequence: bigint;
  readonly server_sequence: bigint;

  readonly encrypter: Encrypter;

  readonly messages: Bytes[];
}

export class TlsClientHandshakeClientFinishedState implements TlsClientHandshakeClientFinishedStateParams {
  readonly type = 'handshake';
  readonly step = 'client_finished';

  readonly client_encrypted = true;
  readonly server_encrypted = false;

  readonly version: number;
  readonly cipher: Cipher;

  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;

  readonly server_random: Bytes<32>;
  readonly server_extensions: Extensions;

  client_sequence: bigint;
  server_sequence: bigint;

  readonly encrypter: Encrypter;

  readonly messages: Bytes[];

  constructor(
    readonly client: TlsClientDuplex,
    readonly params: TlsClientHandshakeClientFinishedStateParams
  ) {
    this.version = params.version;
    this.cipher = params.cipher;

    this.client_random = params.client_random;
    this.client_extensions = params.client_extensions;

    this.server_random = params.server_random;
    this.server_extensions = params.server_extensions;

    this.client_sequence = params.client_sequence;
    this.server_sequence = params.server_sequence;

    this.encrypter = params.encrypter;

    this.messages = params.messages;
  }

  async onOutputStart() {
    throw new InvalidTlsStateError();
  }

  async onOutputWrite(_chunk: Writable) {
    throw new InvalidTlsStateError();
  }

  async onRecord(record: PlaintextRecord<Unknown>) {
    await this.onPlaintextRecord(record);
  }

  async onPlaintextRecord(record: PlaintextRecord<Unknown>) {
    if (record.type === Alert.record_type) return await onAlert(this, record);
    if (record.type === ChangeCipherSpec.record_type)
      return await this.onChangeCipherSpec(record);
    throw new InvalidTlsStateError();
  }

  async onChangeCipherSpec(record: PlaintextRecord<Unknown>) {
    const change_cipher_spec =
      record.fragment.readIntoOrThrow(ChangeCipherSpec);

    Console.debug(change_cipher_spec);

    const {
      version,
      cipher,
      client_random,
      client_extensions,
      server_random,
      server_extensions,
      client_sequence,
      server_sequence,
      encrypter,
      messages,
    } = this;
    this.client.state = new TlsClientHandshakeServerCipheredState(this.client, {
      version,
      cipher,
      client_random,
      client_extensions,
      server_random,
      server_extensions,
      client_sequence,
      server_sequence,
      encrypter,
      messages,
    });
  }
}

export type TlsClientServerEncryptedState =
  | TlsClientHandshakeServerCipheredState
  | TlsClientHandshakedState;

async function onCiphertextRecord(
  state: TlsClientServerEncryptedState,
  record: PlaintextRecord<Unknown>
) {
  if (state.encrypter.cipher_type === 'block') {
    const cipher = BlockCiphertextRecord.fromOrThrow(record);
    const plain = await cipher.decryptOrThrow(
      state.encrypter,
      state.server_sequence++
    );
    await state.onPlaintextRecord(plain);
    return;
  }

  if (state.encrypter.cipher_type === 'aead') {
    const cipher = AEADCiphertextRecord.fromOrThrow(record);
    const plain = await cipher.decryptOrThrow(
      state.encrypter,
      state.server_sequence++
    );
    await state.onPlaintextRecord(plain);
    return;
  }

  throw new InvalidTlsStateError();
}

export interface TlsClientHandshakeServerCipheredStateParams {
  readonly version: number;
  readonly cipher: Cipher;

  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;

  readonly server_random: Bytes<32>;
  readonly server_extensions: Extensions;

  readonly client_sequence: bigint;
  readonly server_sequence: bigint;

  readonly encrypter: Encrypter;

  readonly messages: Bytes[];
}

export class TlsClientHandshakeServerCipheredState implements TlsClientHandshakeServerCipheredStateParams {
  readonly type = 'handshake';
  readonly step = 'server_ciphered';

  readonly client_encrypted = true;
  readonly server_encrypted = true;

  readonly version: number;
  readonly cipher: Cipher;

  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;

  readonly server_random: Bytes<32>;
  readonly server_extensions: Extensions;

  readonly encrypter: Encrypter;

  client_sequence: bigint;
  server_sequence: bigint;

  readonly messages: Bytes[];

  constructor(
    readonly client: TlsClientDuplex,
    readonly params: TlsClientHandshakeClientFinishedStateParams
  ) {
    this.version = params.version;
    this.cipher = params.cipher;

    this.client_random = params.client_random;
    this.client_extensions = params.client_extensions;

    this.server_random = params.server_random;
    this.server_extensions = params.server_extensions;

    this.client_sequence = params.client_sequence;
    this.server_sequence = params.server_sequence;

    this.encrypter = params.encrypter;

    this.messages = params.messages;
  }

  async onOutputStart() {
    throw new InvalidTlsStateError();
  }

  async onOutputWrite(_chunk: Writable) {
    throw new InvalidTlsStateError();
  }

  async onRecord(record: PlaintextRecord<Unknown>) {
    await onCiphertextRecord(this, record);
  }

  async onPlaintextRecord(record: PlaintextRecord<Unknown>) {
    if (record.type === Alert.record_type) return await onAlert(this, record);
    if (record.type === Record.types.handshake)
      return await this.onHandshake(record);
    throw new InvalidTlsStateError();
  }

  async onHandshake(record: PlaintextRecord<Unknown>) {
    const handshake = record.fragment.readIntoOrThrow(Handshake);

    if (handshake.type !== Handshake.types.hello_request)
      this.messages.push(Bytes.from(record.fragment.bytes));

    if (handshake.type === Finished2.handshake_type)
      return this.onFinished(handshake);

    console.warn(handshake);
  }

  async onFinished(handshake: Handshake<Unknown>) {
    const finished = handshake.fragment.readIntoOrThrow(Finished2);

    Console.debug(finished);

    const {
      version,
      cipher,
      client_random,
      client_extensions,
      server_random,
      server_extensions,
      encrypter,
      client_sequence,
      server_sequence,
    } = this;
    this.client.state = new TlsClientHandshakedState(this.client, {
      version,
      cipher,
      client_random,
      client_extensions,
      server_random,
      server_extensions,
      encrypter,
      client_sequence,
      server_sequence,
    });

    this.client.resolveOnHandshake.resolve();
    await this.client.params.handshake?.call(this.client);
  }
}

export interface TlsClientHandshakedStateParams {
  readonly version: number;
  readonly cipher: Cipher;

  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;

  readonly server_random: Bytes<32>;
  readonly server_extensions: Extensions;

  readonly client_sequence: bigint;
  readonly server_sequence: bigint;

  readonly encrypter: Encrypter;
}

export class TlsClientHandshakedState implements TlsClientHandshakedStateParams {
  readonly type = 'handshaked';

  readonly client_encrypted = true;
  readonly server_encrypted = true;

  readonly version: number;
  readonly cipher: Cipher;

  readonly client_random: Bytes<32>;
  readonly client_extensions: Extensions;

  readonly server_random: Bytes<32>;
  readonly server_extensions: Extensions;

  client_sequence: bigint;
  server_sequence: bigint;

  readonly encrypter: Encrypter;

  constructor(
    readonly client: TlsClientDuplex,
    readonly params: TlsClientHandshakedStateParams
  ) {
    this.version = params.version;
    this.cipher = params.cipher;

    this.client_random = params.client_random;
    this.client_extensions = params.client_extensions;

    this.server_random = params.server_random;
    this.server_extensions = params.server_extensions;

    this.client_sequence = params.client_sequence;
    this.server_sequence = params.server_sequence;

    this.encrypter = params.encrypter;
  }

  async onOutputStart() {
    throw new InvalidTlsStateError();
  }

  async onOutputWrite(chunk: Writable) {
    const { version, encrypter } = this;
    const type = Record.types.application_data;

    const plaintext = new PlaintextRecord(type, version, chunk);
    const ciphertext = await plaintext.encryptOrThrow(
      encrypter,
      this.client_sequence++
    );

    this.client.output.enqueue(ciphertext);
  }

  async onRecord(record: PlaintextRecord<Unknown>) {
    await onCiphertextRecord(this, record);
  }

  async onPlaintextRecord(record: PlaintextRecord<Unknown>) {
    if (record.type === Alert.record_type) return await onAlert(this, record);
    if (record.type === Record.types.application_data)
      return await this.onApplicationData(record);
    throw new InvalidTlsStateError();
  }

  async onApplicationData(record: PlaintextRecord<Unknown>) {
    this.client.input.enqueue(record.fragment);
  }
}
