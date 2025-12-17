export * from './length/length.test';
export * from './triplets/index.test';
export * from './type/type.test';
export * from './variable_length_quantity/variable_length_quantity.test';

import { Base64 } from '../../base64/index.ts';
import { Readable, Writable } from '../../binary/mod.ts';
import { assert, test } from '../../phobos/mod.ts';
import { readFile } from 'fs/promises';
import { relative, resolve } from 'node:path';
import { DER } from './resolvers/der/index';

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

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

function compare(a: Uint8Array, b: Uint8Array) {
  return Buffer.from(a).equals(Buffer.from(b));
}

test('Cert Ed25519', async () => {
  const text = await readFile('./certs/ed25519.pem', 'utf8');
  const triplet = Readable.readFromBytesOrThrow(DER, PEM.parse(text));

  assert(compare(PEM.parse(text), Writable.writeToBytesOrThrow(triplet)));
});

test("Cert Let's Encrypt", async () => {
  const text = await readFile('./certs/letsencrypt.pem', 'utf8');
  const triplet = Readable.readFromBytesOrThrow(DER, PEM.parse(text));

  assert(compare(PEM.parse(text), Writable.writeToBytesOrThrow(triplet)));
});

test('Cert PKCS7', async () => {
  const text = await readFile('./certs/pkcs7.pem', 'utf8');
  const triplet = Readable.readFromBytesOrThrow(DER, PKCS7.parse(text));

  assert(compare(PKCS7.parse(text), Writable.writeToBytesOrThrow(triplet)));
});

test('Cert frank4dd-rsa', async () => {
  const buffer = new Uint8Array(await readFile('./certs/frank4dd-rsa.der'));
  const triplet = Readable.readFromBytesOrThrow(DER, buffer);

  assert(compare(buffer, Writable.writeToBytesOrThrow(triplet)));
});

test('Cert frank4dd-dsa', async () => {
  const buffer = new Uint8Array(await readFile('./certs/frank4dd-dsa.der'));
  const triplet = Readable.readFromBytesOrThrow(DER, buffer);

  assert(compare(buffer, Writable.writeToBytesOrThrow(triplet)));
});

test('Cert Tor', async () => {
  const text = await readFile('./certs/tor.pem', 'utf8');
  const buffer = Base64.decodePaddedOrThrow(text);
  const triplet = Readable.readFromBytesOrThrow(DER, buffer);

  assert(compare(buffer, Writable.writeToBytesOrThrow(triplet)));
});

test('Cert Tor 2', async () => {
  const text = await readFile('./certs/tor2.pem', 'utf8');
  const buffer = Base64.decodePaddedOrThrow(text);
  const triplet = Readable.readFromBytesOrThrow(DER, buffer);

  assert(compare(buffer, Writable.writeToBytesOrThrow(triplet)));
});
