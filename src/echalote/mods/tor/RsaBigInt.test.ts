/**
 * Test file for dual RSA implementation
 * Runs both rsa.wasm and BigInt implementations side-by-side
 */

import { test } from '@hazae41/phobos';
import { RsaWasm, Memory as WasmMemory } from '@hazae41/rsa.wasm';
import { RsaBigInt } from './RsaBigInt.js';
import { DualRsaWasm } from './DualRsaWasm.js';
import { assert } from '../../../utils/assert.js';

// Initialize WASM module once before any tests
let wasmInitialized = false;
async function ensureWasmInit() {
  if (!wasmInitialized) {
    await RsaWasm.initBundled();
    await DualRsaWasm.initBundled();
    wasmInitialized = true;
  }
}

test('RSA BigInt: Memory wrapper interface is compatible', async () => {
  await ensureWasmInit();

  const testBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

  const bigIntMem = new RsaBigInt.Memory(testBytes);
  const wasmMem = new WasmMemory(testBytes);

  // Both should have same interface
  assert(
    bigIntMem.len() === testBytes.length,
    'BigInt Memory.len() should match'
  );
  assert(wasmMem.len() === testBytes.length, 'Wasm Memory.len() should match');

  assert(
    bigIntMem.bytes.every((b, i) => b === testBytes[i]),
    'BigInt Memory.bytes should match input'
  );
});

test('RSA BigInt: Memory initializes from ArrayBuffer', async () => {
  const buffer = new ArrayBuffer(8);
  const view = new Uint8Array(buffer);
  view[0] = 42;

  const memory = new RsaBigInt.Memory(buffer);
  assert(memory.bytes[0] === 42, 'ArrayBuffer initialization should work');
  assert(memory.len() === 8, 'ArrayBuffer len() should return 8');
});

test('RSA BigInt: RsaPublicKey interface exists', async () => {
  assert(RsaBigInt.RsaPublicKey !== undefined, 'RsaPublicKey should exist');
  assert(
    RsaBigInt.RsaPublicKey.from_public_key_der !== undefined,
    'from_public_key_der method should exist'
  );
  assert(
    RsaBigInt.RsaPublicKey.from_pkcs1_der !== undefined,
    'from_pkcs1_der method should exist'
  );
});

test('RSA BigInt: handles invalid DER gracefully', async () => {
  const invalidDER = new Uint8Array([0xff, 0xff, 0xff]); // Invalid DER
  const memory = new RsaBigInt.Memory(invalidDER);

  try {
    RsaBigInt.RsaPublicKey.from_public_key_der(memory);
    throw new Error('Should have thrown on invalid DER');
  } catch (e) {
    assert(
      e instanceof Error && e.message.includes('Failed to parse'),
      'Should throw parse error on invalid DER'
    );
  }
});

test('RSA Dual: initializes successfully', async () => {
  await ensureWasmInit();

  assert(DualRsaWasm.Memory !== undefined, 'DualRsaWasm.Memory should exist');
  assert(
    DualRsaWasm.RsaPublicKey !== undefined,
    'DualRsaWasm.RsaPublicKey should exist'
  );
});

test('RSA Dual: DualMemory works with same bytes as input', async () => {
  await ensureWasmInit();

  const testBytes = new Uint8Array([0x30, 0x81, 0x01, 0x02, 0x03]);
  const dualMem = new DualRsaWasm.Memory(testBytes);

  assert(dualMem.len() === testBytes.length, 'DualMemory.len() should match');
  assert(
    dualMem.bytes.every((b, i) => b === testBytes[i]),
    'DualMemory.bytes should match input'
  );
});
