import { test, assert } from '@hazae41/phobos';
import { Ed25519Cert } from './cert.js';
import { Cursor } from '@hazae41/cursor';

// Test data captured from real Tor network communication
const edToSignCertHex =
  '04008c010400077c6001e52c7b9dcf1c558e6fd799a8d432ba73b65cc1b1443490afc84402f9f67501b40100200400057dbffbeb2098fc4b70976658b18d7f31d30bb9263724d2dbb6a8d278372fccb9f407a3676b8b9b02261c8a7a03adfb492a224a32fff64cc932010aa015c8ebb349cafc2fa95ec1e0b0c317a7dee07074e997c33d01d22d2411fd226af57940c';

const signToTlsCertHex =
  '050068010500077b0d03edb538cd2c0d6742d96560f4a626c6c8ad97694080b36c05645c30a9e986d8070059c9d47ea488e01c1c0f879a08b4e4e97cc47477f5c5727384f0d5f1f2cbaed2d1b28340bbbaaab3be48d23e6afa26a4a9649e0edda9a6d78b984df703e13a00';

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

test('Ed25519Cert.readOrThrow - ED_TO_SIGN certificate (type 4)', async () => {
  const bytes = hexToUint8Array(edToSignCertHex);
  const cursor = new Cursor(bytes);

  const cert = Ed25519Cert.readOrThrow(cursor);

  // Verify basic structure
  assert(cert.type === 4, 'Certificate type should be 4 (ED_TO_SIGN)');
  assert(cert.version === 1, 'Certificate version should be 1');
  assert(cert.certType === 4, 'Cert type should be 4');

  // Verify expiration date
  assert(cert.expiration instanceof Date, 'Expiration should be a Date');
  assert(cert.expiration.getTime() > 0, 'Expiration should be a valid date');

  // Verify cert key
  assert(cert.certKeyType === 1, 'Cert key type should be 1 (Ed25519)');
  assert(cert.certKey.length === 32, 'Cert key should be 32 bytes');

  // Verify signature
  assert(cert.signature.length === 64, 'Signature should be 64 bytes');

  // Verify extensions
  assert(cert.extensions.signer !== undefined, 'Should have signer extension');
  if (cert.extensions.signer) {
    assert(
      cert.extensions.signer.key.length === 32,
      'Signer key should be 32 bytes'
    );
  }

  // Verify payload exists
  assert(cert.payload.length > 0, 'Payload should not be empty');
});

test('Ed25519Cert.readOrThrow - SIGN_TO_TLS certificate (type 5)', async () => {
  const bytes = hexToUint8Array(signToTlsCertHex);
  const cursor = new Cursor(bytes);

  const cert = Ed25519Cert.readOrThrow(cursor);

  // Verify basic structure
  assert(cert.type === 5, 'Certificate type should be 5 (SIGN_TO_TLS)');
  assert(cert.version === 1, 'Certificate version should be 1');
  assert(cert.certType === 5, 'Cert type should be 5');

  // Verify expiration date
  assert(cert.expiration instanceof Date, 'Expiration should be a Date');
  assert(cert.expiration.getTime() > 0, 'Expiration should be a valid date');

  // Verify cert key
  assert(cert.certKeyType === 3, 'Cert key type should be 3');
  assert(cert.certKey.length === 32, 'Cert key should be 32 bytes');

  // Verify signature
  assert(cert.signature.length === 64, 'Signature should be 64 bytes');

  // Verify no signer extension (SIGN_TO_TLS certs are self-signed)
  assert(
    cert.extensions.signer === undefined,
    'Should not have signer extension'
  );

  // Verify payload exists
  assert(cert.payload.length > 0, 'Payload should not be empty');
});

test('Ed25519Cert.readOrThrow - cursor advances correctly', async () => {
  const bytes = hexToUint8Array(edToSignCertHex);
  const cursor = new Cursor(bytes);

  const startOffset = cursor.offset;
  Ed25519Cert.readOrThrow(cursor);
  const endOffset = cursor.offset;

  // Cursor should have advanced past the entire certificate
  assert(endOffset > startOffset, 'Cursor should advance after reading');
  assert(endOffset === bytes.length, 'Cursor should be at end of data');
});

test('Ed25519Cert - constants', async () => {
  assert(Ed25519Cert.types.ED_TO_SIGN === 4, 'ED_TO_SIGN type should be 4');
  assert(Ed25519Cert.types.SIGN_TO_TLS === 5, 'SIGN_TO_TLS type should be 5');
  assert(Ed25519Cert.types.SIGN_TO_AUTH === 6, 'SIGN_TO_AUTH type should be 6');

  assert(
    Ed25519Cert.flags.AFFECTS_VALIDATION === 1,
    'AFFECTS_VALIDATION flag should be 1'
  );
});
