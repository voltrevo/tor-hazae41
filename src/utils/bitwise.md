# bitwise.ts

Pure JavaScript implementation of bitwise operations for bit/byte conversions.

This module provides freestanding functions compatible with `@hazae41/bitwise.wasm` but without the WebAssembly overhead. It's ~370 KB smaller in bundle size and has no WASM initialization cost.

## Functions

### `bitwise_unpack(bytes: Uint8Array): Uint8Array`

Unpacks bytes into individual bits. Each byte is expanded to 8 bytes, where each byte contains a single bit (0 or 1).

- Reads bits from MSB to LSB (most significant bit first)
- Example: `0b10110010` → `[1, 0, 1, 1, 0, 0, 1, 0]`

### `bitwise_pack_left(bits: Uint8Array): Uint8Array`

Packs bits into bytes, with partial bytes right-aligned (zero padding on the left/MSB side). Each 8 bits are combined into 1 byte, with the first bit becoming the MSB.

- Inverse of `bitwise_unpack` for full bytes
- Full bytes: `[1, 0, 1, 1, 0, 0, 1, 0]` → `0b10110010`
- Partial bytes: `[1, 0, 1, 1]` (4 bits) → `0b00001011` (zeros padded on left)

### `bitwise_pack_right(bits: Uint8Array): Uint8Array`

Packs bits into bytes with partial bytes left-aligned (zero padding on the right/LSB side). Each 8 bits are combined into 1 byte, with the first bit becoming the MSB.

- Full bytes: `[1, 0, 1, 1, 0, 0, 1, 0]` → `0b10110010`
- Partial bytes: `[1, 0, 1, 1]` (4 bits) → `0b10110000` (zeros padded on right)

### `bitwise_xor_mod(target: Uint8Array, mask: Uint8Array): void`

Applies XOR mask to target bytes in-place. Modifies the first argument.

- Example: `xor_mod([0xFF, 0xAA], [0x0F, 0xFF])` → `[0xF0, 0x55]`
- Only XORs up to the minimum of the two array lengths

## Usage

```typescript
import {
  bitwise_unpack,
  bitwise_pack_left,
  bitwise_xor_mod,
} from './utils/bitwise';

// Convert bytes to bits
const bytes = new Uint8Array([0b10110010]);
const bits = bitwise_unpack(bytes);
// bits = [1, 0, 1, 1, 0, 0, 1, 0]

// Extract specific bits
const opcodeBits = bits.subarray(4, 8);

// Convert back to bytes
const repacked = bitwise_pack_left(bits);
// repacked[0] = 0b10110010

// XOR operation
const masked = new Uint8Array([0xff, 0xaa]);
const mask = new Uint8Array([0x0f, 0xff]);
bitwise_xor_mod(masked, mask);
// masked = [0xF0, 0x55]
```

## Size Comparison

- **bitwise.ts**: ~500 bytes (uncompressed)
- **@hazae41/bitwise.wasm**: 22.1 KB (embedded data URL)

## WebSocket Frame Example

This module is used in WebSocket frame parsing/serialization:

```typescript
// Reading a WebSocket frame
const opcodeBytesCursor = new Cursor(Bytes.alloc(1));
opcodeBytesCursor.writeUint8OrThrow(0b00001010);

const opcodeBits = bitwise_unpack(opcodeBytesCursor.bytes);
const opcode = opcodeBits.subarray(4); // Extract last 4 bits

// Writing a WebSocket frame with mask
const maskBytes = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
const payloadBytes = new Uint8Array([0xff, 0x00, 0xff]);

const maskBits = bitwise_unpack(maskBytes);
const payloadBits = bitwise_unpack(payloadBytes);

// XOR masking
bitwise_xor_mod(payloadBytes, maskBytes);

const maskedBits = bitwise_unpack(payloadBytes);
```
