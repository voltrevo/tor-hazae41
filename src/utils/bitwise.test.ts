import { test } from '../hazae41/phobos/mod';
import { assert } from './assert';
import {
  bitwise_pack_left,
  bitwise_pack_right,
  bitwise_unpack,
  bitwise_xor_mod,
} from './bitwise';
import { Bytes } from '../hazae41/bytes';

/**
 * Test vectors generated from @hazae41/bitwise.wasm
 * These vectors verify that our pure JS implementation is 100% compatible
 */
const TEST_VECTORS = {
  unpack: [
    { input: [0], output: [0, 0, 0, 0, 0, 0, 0, 0] },
    { input: [255], output: [1, 1, 1, 1, 1, 1, 1, 1] },
    { input: [170], output: [1, 0, 1, 0, 1, 0, 1, 0] },
    { input: [85], output: [0, 1, 0, 1, 0, 1, 0, 1] },
    { input: [178], output: [1, 0, 1, 1, 0, 0, 1, 0] },
    {
      input: [0, 255],
      output: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    },
    {
      input: [170, 85, 255],
      output: [
        1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      ],
    },
    {
      input: [1, 2, 4, 8, 16, 32, 64, 128],
      output: [
        0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0,
        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,
        0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0,
      ],
    },
  ],
  pack_left: [
    { input: [0, 0, 0, 0, 0, 0, 0, 0], output: [0] },
    { input: [1, 1, 1, 1, 1, 1, 1, 1], output: [255] },
    { input: [1, 0, 1, 0, 1, 0, 1, 0], output: [170] },
    { input: [0, 1, 0, 1, 0, 1, 0, 1], output: [85] },
    { input: [1, 0, 1, 1, 0, 0, 1, 0], output: [178] },
    { input: [1, 0, 0, 0, 0, 0, 0, 0], output: [128] },
    { input: [0, 0, 0, 0, 0, 0, 0, 1], output: [1] },
    {
      input: [1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1],
      output: [170, 85],
    },
    { input: [1, 0, 1, 1], output: [11] },
    { input: [1], output: [1] },
  ],
  pack_right: [
    { input: [0, 0, 0, 0, 0, 0, 0, 0], output: [0] },
    { input: [1, 1, 1, 1, 1, 1, 1, 1], output: [255] },
    { input: [1, 0, 1, 0, 1, 0, 1, 0], output: [170] },
    { input: [0, 1, 0, 1, 0, 1, 0, 1], output: [85] },
    { input: [1, 0, 1, 1, 0, 0, 1, 0], output: [178] },
    { input: [1, 0, 0, 0, 0, 0, 0, 0], output: [128] },
    { input: [0, 0, 0, 0, 0, 0, 0, 1], output: [1] },
    {
      input: [1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1],
      output: [170, 85],
    },
    { input: [1, 0, 1, 1], output: [176] },
    { input: [1], output: [128] },
  ],
  xor_mod: [
    { target: [255, 255], mask: [0, 0], output: [255, 255] },
    { target: [255, 255], mask: [255, 255], output: [0, 0] },
    { target: [170, 85], mask: [15, 240], output: [165, 165] },
    { target: [18, 52, 86], mask: [120, 154, 188], output: [106, 174, 234] },
    { target: [255, 255, 255], mask: [15], output: [240, 240, 240] },
    { target: [255], mask: [15, 255, 255], output: [240] },
  ],
};

function assertBytesEqual(
  actual: Bytes,
  expected: number[],
  message?: string
): void {
  assert(
    actual.length === expected.length,
    `${message || ''} length mismatch: ${actual.length} !== ${expected.length}`
  );
  for (let i = 0; i < actual.length; i++) {
    assert(
      actual[i] === expected[i],
      `${message || ''} byte ${i}: ${actual[i]} !== ${expected[i]}`
    );
  }
}

test('bitwise_unpack', async () => {
  for (let i = 0; i < TEST_VECTORS.unpack.length; i++) {
    const vector = TEST_VECTORS.unpack[i];
    const bytes = Bytes.from(vector.input);
    const bits = bitwise_unpack(bytes);

    assertBytesEqual(bits, vector.output, `unpack vector ${i}`);
  }
});

test('bitwise_pack_left', async () => {
  for (let i = 0; i < TEST_VECTORS.pack_left.length; i++) {
    const vector = TEST_VECTORS.pack_left[i];
    const bits = Bytes.from(vector.input);
    const bytes = bitwise_pack_left(bits);

    assertBytesEqual(bytes, vector.output, `pack_left vector ${i}`);
  }
});

test('bitwise_pack_right', async () => {
  for (let i = 0; i < TEST_VECTORS.pack_right.length; i++) {
    const vector = TEST_VECTORS.pack_right[i];
    const bits = Bytes.from(vector.input);
    const bytes = bitwise_pack_right(bits);

    assertBytesEqual(bytes, vector.output, `pack_right vector ${i}`);
  }
});

test('bitwise_xor_mod', async () => {
  for (let i = 0; i < TEST_VECTORS.xor_mod.length; i++) {
    const vector = TEST_VECTORS.xor_mod[i];
    const target = Bytes.from(vector.target);
    const mask = Bytes.from(vector.mask);

    bitwise_xor_mod(target, mask);

    assertBytesEqual(target, vector.output, `xor_mod vector ${i}`);
  }
});

test('bitwise roundtrip: unpack -> pack_left', async () => {
  const original = Bytes.from([0xa5, 0x3c, 0xf0]);
  const bits = bitwise_unpack(original);
  const recovered = bitwise_pack_left(bits);

  assertBytesEqual(recovered, Array.from(original), 'roundtrip');
});

test('WebSocket scenario: opcode extraction', async () => {
  const opcodeBytes = Bytes.from([0b00001010]); // opcode 10 (pong)
  const opcodeBits = bitwise_unpack(opcodeBytes);

  // Extract last 4 bits (as the code does)
  const opcodeOnly = opcodeBits.subarray(4); // [1, 0, 1, 0]
  assert(opcodeOnly.length === 4, `length ${opcodeOnly.length} !== 4`);
  assert(opcodeOnly[0] === 1, `opcodeOnly[0] ${opcodeOnly[0]} !== 1`);
  assert(opcodeOnly[3] === 0, `opcodeOnly[3] ${opcodeOnly[3]} !== 0`);
});
