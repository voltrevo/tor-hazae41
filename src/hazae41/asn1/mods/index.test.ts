import { Base64 } from '../../base64/index';
import { Readable, Writable } from '../../binary/mod';
import { assert, test } from '../../phobos/mod';
import { DER } from './resolvers/der/index';
import { Bytes } from '../../bytes';
import { TestCerts } from '../../TestCerts';

export namespace PEM {
  export const header = `-----BEGIN CERTIFICATE-----`;
  export const footer = `-----END CERTIFICATE-----`;

  export function parse(text: string) {
    text = text.replaceAll(`\n`, ``);

    if (!text.startsWith(header)) throw new Error(`Missing PEM header`);
    if (!text.endsWith(footer)) throw new Error(`Missing PEM footer`);

    const body = text.slice(header.length, -footer.length);

    return Base64.decodePaddedOrThrow(body);
  }
}

export namespace PKCS7 {
  export const header = `-----BEGIN PKCS7-----`;
  export const footer = `-----END PKCS7-----`;

  export function parse(text: string) {
    text = text.replaceAll(`\n`, ``);

    if (!text.startsWith(header)) throw new Error(`Missing PKCS7 header`);
    if (!text.endsWith(footer)) throw new Error(`Missing PKCS7 footer`);

    const body = text.slice(header.length, -footer.length);

    return Base64.decodePaddedOrThrow(body);
  }
}


function compare(a: Bytes, b: Bytes) {
  return Buffer.from(a).equals(Buffer.from(b));
}

test('Cert Ed25519', async () => {
  const text = TestCerts.ed25519;
  const triplet = Readable.readFromBytesOrThrow(DER, PEM.parse(text));

  assert(compare(PEM.parse(text), Writable.writeToBytesOrThrow(triplet)));
});

test("Cert Let's Encrypt", async () => {
  const text = TestCerts.letsencrypt;
  const triplet = Readable.readFromBytesOrThrow(DER, PEM.parse(text));

  assert(compare(PEM.parse(text), Writable.writeToBytesOrThrow(triplet)));
});

test('Cert PKCS7', async () => {
  const text = TestCerts.pkcs7;
  const triplet = Readable.readFromBytesOrThrow(DER, PKCS7.parse(text));

  assert(compare(PKCS7.parse(text), Writable.writeToBytesOrThrow(triplet)));
});

test('Cert frank4dd-rsa', async () => {
  const buffer = Bytes.from(TestCerts.frank4dd_rsa);
  const triplet = Readable.readFromBytesOrThrow(DER, buffer);

  assert(compare(buffer, Writable.writeToBytesOrThrow(triplet)));
});

test('Cert frank4dd-dsa', async () => {
  const buffer = Bytes.from(TestCerts.frank4dd_dsa);
  const triplet = Readable.readFromBytesOrThrow(DER, buffer);

  assert(compare(buffer, Writable.writeToBytesOrThrow(triplet)));
});

test('Cert Tor', async () => {
  const text = TestCerts.torTrimmed;
  const buffer = Base64.decodePaddedOrThrow(text);
  const triplet = Readable.readFromBytesOrThrow(DER, buffer);

  assert(compare(buffer, Writable.writeToBytesOrThrow(triplet)));
});

test('Cert Tor 2', async () => {
  const text = TestCerts.tor2Trimmed;
  const buffer = Base64.decodePaddedOrThrow(text);
  const triplet = Readable.readFromBytesOrThrow(DER, buffer);

  assert(compare(buffer, Writable.writeToBytesOrThrow(triplet)));
});
