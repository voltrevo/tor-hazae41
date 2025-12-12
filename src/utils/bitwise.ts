/**
 * Pure JavaScript bitwise operations module
 * Provides freestanding functions for bit/byte conversions
 * Compatible API with @hazae41/bitwise.wasm but without WebAssembly overhead
 */

/**
 * Unpack bytes into individual bits
 * Each byte is expanded to 8 bytes, where each byte contains a single bit (0 or 1)
 * Example: 0b10110010 -> [1, 0, 1, 1, 0, 0, 1, 0]
 */
export function bitwise_unpack(bytes: Uint8Array): Uint8Array {
  const bits = new Uint8Array(bytes.length * 8);

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    for (let j = 0; j < 8; j++) {
      // Extract bit at position (7 - j) from MSB to LSB
      bits[i * 8 + j] = (byte >> (7 - j)) & 1;
    }
  }

  return bits;
}

/**
 * Pack bits into bytes (from left to right)
 * Each 8 bits are packed into 1 byte
 * The first bit becomes the MSB, last bit becomes the LSB
 * For partial bytes (< 8 bits), bits are right-aligned with zero padding on the left
 * Example: [1, 0, 1, 1] → 0b00001011 (padded with 4 zeros on the left)
 */
export function bitwise_pack_left(bits: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));

  let bitIndex = 0;
  const bitsLen = bits.length;
  const remainder = bitsLen % 8;

  // Process partial byte first (if any), with zeros on the left (MSB side)
  if (remainder > 0) {
    let byte = 0;
    for (let j = 0; j < remainder; j++) {
      byte = (byte << 1) | (bits[bitIndex++] & 1);
    }
    bytes[0] = byte;
  }

  // Process remaining full 8-bit bytes
  let byteIndex = remainder > 0 ? 1 : 0;
  while (bitIndex < bitsLen) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[bitIndex++] & 1);
    }
    bytes[byteIndex++] = byte;
  }

  return bytes;
}

/**
 * Pack bits into bytes (from right to left)
 * Each 8 bits are packed into 1 byte
 * Bits are placed from MSB, with padding on the right for partial bytes
 * Example: [1, 0, 1, 1] → 0b10110000 (padded with 4 zeros on the right)
 */
export function bitwise_pack_right(bits: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));

  let bitIndex = 0;
  const bitsLen = bits.length;
  const remainder = bitsLen % 8;

  // Process full bytes first (bits 0 to bitsLen - remainder)
  while (bitIndex < bitsLen - remainder) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[bitIndex++] & 1);
    }
    bytes[bitIndex / 8 - 1] = byte;
  }

  // Then process remaining partial byte (if any), with padding on the right (LSB side)
  if (remainder > 0) {
    let byte = 0;
    // Process the remainder bits
    for (let j = 0; j < remainder; j++) {
      byte = (byte << 1) | (bits[bitIndex++] & 1);
    }
    // Shift left to align to MSB side (add zeros on the right)
    bytes[Math.floor(bitsLen / 8)] = byte << (8 - remainder);
  }

  return bytes;
}

/**
 * XOR mask: applies mask bytes to target bytes in-place
 * Modifies the first argument. Mask repeats if shorter than target.
 * Example: xor_mod([0xFF, 0xFF], [0x0F]) -> [0xF0, 0xF0]
 */
export function bitwise_xor_mod(target: Uint8Array, mask: Uint8Array): void {
  for (let i = 0; i < target.length; i++) {
    target[i] ^= mask[i % mask.length];
  }
}
