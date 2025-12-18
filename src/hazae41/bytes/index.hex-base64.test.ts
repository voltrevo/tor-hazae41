import { test, expect } from 'vitest';
import { Bytes } from '.';

// Hex test vectors
const hexTest0Hex = '';
const hexTest0Bytes = [] as const;

const hexTest1Hex = 'ff';
const hexTest1Bytes = [255] as const;

const hexTest2Hex = '00010203';
const hexTest2Bytes = [0, 1, 2, 3] as const;

const hexTest3Hex = 'deadbeef';
const hexTest3Bytes = [222, 173, 190, 239] as const;

const hexTest4Hex = '68656c6c6f';
const hexTest4Bytes = [104, 101, 108, 108, 111] as const;

// Base64 test vectors
const base64Test0Text = '';
const base64Test0Bytes = [] as const;

const base64Test1Text = '/w==';
const base64Test1Bytes = [255] as const;

const base64Test2Text = 'AAECAw==';
const base64Test2Bytes = [0, 1, 2, 3] as const;

const base64Test3Text = '3q2+7w==';
const base64Test3Bytes = [222, 173, 190, 239] as const;

const base64Test4Text = 'aGVsbG8=';
const base64Test4Bytes = [104, 101, 108, 108, 111] as const;

const base64Test5Text = 'aGVsbG8gd29ybGQ=';
const base64Test5Bytes = [
  104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100,
] as const;

// Base64url specific test vectors (with + or / characters)
const base64UrlTestPlusB64 = '+/8=';
const base64UrlTestPlusB64url = '-_8=';
const base64UrlTestPlusBytes = [251, 255] as const;

const base64UrlTestSlashB64 = '//4=';
const base64UrlTestSlashB64url = '__4=';
const base64UrlTestSlashBytes = [255, 254] as const;

const base64UrlTestBothB64 = '+//+';
const base64UrlTestBothB64url = '-__-';
const base64UrlTestBothBytes = [251, 255, 254] as const;

// Hex encoding tests
test('Bytes.toHex empty', async () => {
  const bytes = Bytes.from(hexTest0Bytes);
  const hex = Bytes.toHex(bytes);
  expect(hex === hexTest0Hex).toBe(true);
});

test('Bytes.toHex single byte', async () => {
  const bytes = Bytes.from(hexTest1Bytes);
  const hex = Bytes.toHex(bytes);
  expect(hex === hexTest1Hex).toBe(true);
});

test('Bytes.toHex four bytes', async () => {
  const bytes = Bytes.from(hexTest2Bytes);
  const hex = Bytes.toHex(bytes);
  expect(hex === hexTest2Hex).toBe(true);
});

test('Bytes.toHex high bytes', async () => {
  const bytes = Bytes.from(hexTest3Bytes);
  const hex = Bytes.toHex(bytes);
  expect(hex === hexTest3Hex).toBe(true);
});

test('Bytes.toHex ascii', async () => {
  const bytes = Bytes.from(hexTest4Bytes);
  const hex = Bytes.toHex(bytes);
  expect(hex === hexTest4Hex).toBe(true);
});

// Hex decoding tests
test('Bytes.fromHex empty', async () => {
  const bytes = Bytes.fromHex(hexTest0Hex);
  expect(Bytes.equals(bytes, Bytes.from(hexTest0Bytes))).toBe(true);
});

test('Bytes.fromHex single byte', async () => {
  const bytes = Bytes.fromHex(hexTest1Hex);
  expect(Bytes.equals(bytes, Bytes.from(hexTest1Bytes))).toBe(true);
});

test('Bytes.fromHex four bytes', async () => {
  const bytes = Bytes.fromHex(hexTest2Hex);
  expect(Bytes.equals(bytes, Bytes.from(hexTest2Bytes))).toBe(true);
});

test('Bytes.fromHex high bytes', async () => {
  const bytes = Bytes.fromHex(hexTest3Hex);
  expect(Bytes.equals(bytes, Bytes.from(hexTest3Bytes))).toBe(true);
});

test('Bytes.fromHex ascii', async () => {
  const bytes = Bytes.fromHex(hexTest4Hex);
  expect(Bytes.equals(bytes, Bytes.from(hexTest4Bytes))).toBe(true);
});

// Hex roundtrip tests
test('Bytes hex roundtrip', async () => {
  const original = Bytes.from([0xde, 0xad, 0xbe, 0xef] as const);
  const hex = Bytes.toHex(original);
  const decoded = Bytes.fromHex(hex);
  expect(Bytes.equals(decoded, original)).toBe(true);
});

// Base64 encoding tests (padded)
test('Bytes.toBase64 empty', async () => {
  const bytes = Bytes.from(base64Test0Bytes);
  const b64 = Bytes.toBase64(bytes);
  expect(b64 === base64Test0Text).toBe(true);
});

test('Bytes.toBase64 single byte', async () => {
  const bytes = Bytes.from(base64Test1Bytes);
  const b64 = Bytes.toBase64(bytes);
  expect(b64 === base64Test1Text).toBe(true);
});

test('Bytes.toBase64 four bytes', async () => {
  const bytes = Bytes.from(base64Test2Bytes);
  const b64 = Bytes.toBase64(bytes);
  expect(b64 === base64Test2Text).toBe(true);
});

test('Bytes.toBase64 high bytes', async () => {
  const bytes = Bytes.from(base64Test3Bytes);
  const b64 = Bytes.toBase64(bytes);
  expect(b64 === base64Test3Text).toBe(true);
});

test('Bytes.toBase64 ascii', async () => {
  const bytes = Bytes.from(base64Test4Bytes);
  const b64 = Bytes.toBase64(bytes);
  expect(b64 === base64Test4Text).toBe(true);
});

test('Bytes.toBase64 long string', async () => {
  const bytes = Bytes.from(base64Test5Bytes);
  const b64 = Bytes.toBase64(bytes);
  expect(b64 === base64Test5Text).toBe(true);
});

// Base64 decoding tests (padded)
test('Bytes.fromBase64 empty', async () => {
  const bytes = Bytes.fromBase64(base64Test0Text);
  expect(Bytes.equals(bytes, Bytes.from(base64Test0Bytes))).toBe(true);
});

test('Bytes.fromBase64 single byte', async () => {
  const bytes = Bytes.fromBase64(base64Test1Text);
  expect(Bytes.equals(bytes, Bytes.from(base64Test1Bytes))).toBe(true);
});

test('Bytes.fromBase64 four bytes', async () => {
  const bytes = Bytes.fromBase64(base64Test2Text);
  expect(Bytes.equals(bytes, Bytes.from(base64Test2Bytes))).toBe(true);
});

test('Bytes.fromBase64 high bytes', async () => {
  const bytes = Bytes.fromBase64(base64Test3Text);
  expect(Bytes.equals(bytes, Bytes.from(base64Test3Bytes))).toBe(true);
});

test('Bytes.fromBase64 ascii', async () => {
  const bytes = Bytes.fromBase64(base64Test4Text);
  expect(Bytes.equals(bytes, Bytes.from(base64Test4Bytes))).toBe(true);
});

test('Bytes.fromBase64 long string', async () => {
  const bytes = Bytes.fromBase64(base64Test5Text);
  expect(Bytes.equals(bytes, Bytes.from(base64Test5Bytes))).toBe(true);
});

// Base64 roundtrip tests
test('Bytes base64 roundtrip', async () => {
  const original = Bytes.from([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe] as const);
  const b64 = Bytes.toBase64(original);
  const decoded = Bytes.fromBase64(b64);
  expect(Bytes.equals(decoded, original)).toBe(true);
});

// Base64url encoding tests
test('Bytes.toBase64 base64url with plus sign', async () => {
  const bytes = Bytes.from(base64UrlTestPlusBytes);
  const b64 = Bytes.toBase64(bytes);
  const b64url = Bytes.toBase64(bytes, { alphabet: 'base64url' });
  expect(b64 === base64UrlTestPlusB64).toBe(true);
  expect(b64url === base64UrlTestPlusB64url).toBe(true);
  expect(b64url !== (b64 as string)).toBe(true);
});

test('Bytes.toBase64 base64url with slash', async () => {
  const bytes = Bytes.from(base64UrlTestSlashBytes);
  const b64 = Bytes.toBase64(bytes);
  const b64url = Bytes.toBase64(bytes, { alphabet: 'base64url' });
  expect(b64 === base64UrlTestSlashB64).toBe(true);
  expect(b64url === base64UrlTestSlashB64url).toBe(true);
  expect(b64url !== (b64 as string)).toBe(true);
});

test('Bytes.toBase64 base64url with both + and /', async () => {
  const bytes = Bytes.from(base64UrlTestBothBytes);
  const b64 = Bytes.toBase64(bytes);
  const b64url = Bytes.toBase64(bytes, { alphabet: 'base64url' });
  expect(b64 === base64UrlTestBothB64).toBe(true);
  expect(b64url === base64UrlTestBothB64url).toBe(true);
  expect(b64url !== (b64 as string)).toBe(true);
});

// Base64url decoding tests
test('Bytes.fromBase64 base64url with underscore', async () => {
  const bytes = Bytes.fromBase64(base64UrlTestPlusB64url, {
    alphabet: 'base64url',
  });
  expect(Bytes.equals(bytes, Bytes.from(base64UrlTestPlusBytes))).toBe(true);
});

test('Bytes.fromBase64 base64url with dash', async () => {
  const bytes = Bytes.fromBase64(base64UrlTestSlashB64url, {
    alphabet: 'base64url',
  });
  expect(Bytes.equals(bytes, Bytes.from(base64UrlTestSlashBytes))).toBe(true);
});

test('Bytes.fromBase64 base64url with both dash and underscore', async () => {
  const bytes = Bytes.fromBase64(base64UrlTestBothB64url, {
    alphabet: 'base64url',
  });
  expect(Bytes.equals(bytes, Bytes.from(base64UrlTestBothBytes))).toBe(true);
});

// Base64url unpadded encoding tests
test('Bytes.toBase64 base64url unpadded with plus', async () => {
  const bytes = Bytes.from(base64UrlTestPlusBytes);
  const b64url = Bytes.toBase64(bytes, {
    alphabet: 'base64url',
    omitPadding: true,
  });
  expect(b64url === '-_8').toBe(true);
});

test('Bytes.toBase64 base64url unpadded with slash', async () => {
  const bytes = Bytes.from(base64UrlTestSlashBytes);
  const b64url = Bytes.toBase64(bytes, {
    alphabet: 'base64url',
    omitPadding: true,
  });
  expect(b64url === '__4').toBe(true);
});

test('Bytes.toBase64 base64url unpadded with both', async () => {
  const bytes = Bytes.from(base64UrlTestBothBytes);
  const b64url = Bytes.toBase64(bytes, {
    alphabet: 'base64url',
    omitPadding: true,
  });
  expect(b64url === '-__-').toBe(true);
});

// Base64url unpadded decoding tests
test('Bytes.fromBase64 base64url unpadded with underscore', async () => {
  const bytes = Bytes.fromBase64('-_8', { alphabet: 'base64url' });
  expect(Bytes.equals(bytes, Bytes.from(base64UrlTestPlusBytes))).toBe(true);
});

test('Bytes.fromBase64 base64url unpadded with dash', async () => {
  const bytes = Bytes.fromBase64('__4', { alphabet: 'base64url' });
  expect(Bytes.equals(bytes, Bytes.from(base64UrlTestSlashBytes))).toBe(true);
});

test('Bytes.fromBase64 base64url unpadded with both', async () => {
  const bytes = Bytes.fromBase64('-__-', { alphabet: 'base64url' });
  expect(Bytes.equals(bytes, Bytes.from(base64UrlTestBothBytes))).toBe(true);
});

// Base64 unpadded tests
test('Bytes.toBase64 unpadded empty', async () => {
  const bytes = Bytes.from(base64Test0Bytes);
  const b64 = Bytes.toBase64(bytes, { omitPadding: true });
  expect(b64 === '').toBe(true);
});

test('Bytes.toBase64 unpadded single byte', async () => {
  const bytes = Bytes.from(base64Test1Bytes);
  const b64 = Bytes.toBase64(bytes, { omitPadding: true });
  expect(b64 === '/w').toBe(true);
});

test('Bytes.toBase64 unpadded four bytes', async () => {
  const bytes = Bytes.from(base64Test2Bytes);
  const b64 = Bytes.toBase64(bytes, { omitPadding: true });
  expect(b64 === 'AAECAw').toBe(true);
});

// Base64 unpadded decoding (should auto-pad)
test('Bytes.fromBase64 unpadded single byte', async () => {
  const bytes = Bytes.fromBase64('/w');
  expect(Bytes.equals(bytes, Bytes.from(base64Test1Bytes))).toBe(true);
});

test('Bytes.fromBase64 unpadded four bytes', async () => {
  const bytes = Bytes.fromBase64('AAECAw');
  expect(Bytes.equals(bytes, Bytes.from(base64Test2Bytes))).toBe(true);
});

// Error cases
test('Bytes.fromHex invalid odd length', async () => {
  try {
    Bytes.fromHex('abc');
    expect(false).toBe(true);
  } catch {
    // Expected
  }
});

test('Bytes.fromHex invalid characters', async () => {
  try {
    Bytes.fromHex('zz');
    expect(false).toBe(true);
  } catch {
    // Expected
  }
});

test('Bytes.fromBase64 invalid string', async () => {
  try {
    Bytes.fromBase64('!!!invalid!!!');
    expect(false).toBe(true);
  } catch {
    // Expected
  }
});
