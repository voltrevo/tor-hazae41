import { assert, test } from '../../phobos/mod';
import { readFile } from 'fs/promises';
import { PEM } from './pem/pem';
import { Certificate } from './types/certificate/certificate';
import { relative, resolve } from 'path';
import {
  readAndResolveFromBytesOrThrow,
  writeToBytesOrThrow,
} from './types/index';
import { Bytes } from '../../bytes';

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

test('Cert Ed25519', async () => {
  const bytes = PEM.decodeOrThrow(
    await readFile('./certs/ed25519.pem', 'utf8')
  );
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test("Cert Let's Encrypt", async () => {
  const bytes = PEM.decodeOrThrow(
    await readFile('./certs/letsencrypt.pem', 'utf8')
  );
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert frank4dd-rsa', async () => {
  const bytes = Bytes.from(await readFile('./certs/frank4dd-rsa.der'));
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert frank4dd-dsa', async () => {
  const bytes = Bytes.from(await readFile('./certs/frank4dd-dsa.der'));
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert Tor', async () => {
  const bytes = PEM.decodeOrThrow(await readFile('./certs/tor.pem', 'utf8'));
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert Tor 2', async () => {
  const bytes = PEM.decodeOrThrow(await readFile('./certs/tor2.pem', 'utf8'));
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert full', async () => {
  const bytes = PEM.decodeOrThrow(await readFile('./certs/full.pem', 'utf8'));
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);
  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('ISRG Root X1', async () => {
  const bytes = PEM.decodeOrThrow(
    await readFile('./certs/isrg-root-x1.pem', 'utf8')
  );
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);
  console.log(cert.tbsCertificate.issuer.toX501OrThrow());
  console.log(cert.tbsCertificate.subject.toX501OrThrow());
  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});
