import { assert, test } from '../../phobos/mod';
import { PEM } from './pem/pem';
import { Certificate } from './types/certificate/certificate';
import {
  readAndResolveFromBytesOrThrow,
  writeToBytesOrThrow,
} from './types/index';
import { Bytes } from '../../bytes';
import { TestCerts } from '../../common/TestCerts';

test('Cert Ed25519', async () => {
  const bytes = PEM.decodeOrThrow(TestCerts.ed25519);
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test("Cert Let's Encrypt", async () => {
  const bytes = PEM.decodeOrThrow(TestCerts.letsencrypt);
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert frank4dd-rsa', async () => {
  const bytes = Bytes.from(TestCerts.frank4dd_rsa);
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert frank4dd-dsa', async () => {
  const bytes = Bytes.from(TestCerts.frank4dd_dsa);
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert Tor', async () => {
  const bytes = PEM.decodeOrThrow(TestCerts.tor);
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert Tor 2', async () => {
  const bytes = PEM.decodeOrThrow(TestCerts.tor2);
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);

  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('Cert full', async () => {
  const bytes = PEM.decodeOrThrow(TestCerts.full);
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);
  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});

test('ISRG Root X1', async () => {
  const bytes = PEM.decodeOrThrow(TestCerts.isrg_root_x1);
  const cert = readAndResolveFromBytesOrThrow(Certificate, bytes);
  assert(Bytes.equals(bytes, writeToBytesOrThrow(cert)));
});
