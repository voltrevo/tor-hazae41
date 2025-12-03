import { ReadUnderflowError } from '@hazae41/binary';
import {
  bitwise_pack_left,
  bitwise_unpack,
  bitwise_xor_mod,
  BitwiseWasm,
} from '@hazae41/bitwise.wasm';
import { Bytes, Uint8Array } from '@hazae41/bytes';
import { Cursor } from '@hazae41/cursor';
import { Length } from './length';

export class WebSocketFrame {
  readonly #class = WebSocketFrame;

  static readonly opcodes = {
    continuation: 0,
    text: 1,
    binary: 2,

    /**
     * Control
     */
    close: 8,
    ping: 9,
    pong: 10,
  } as const;

  readonly length: Length;

  private constructor(
    readonly final: boolean,
    readonly opcode: number,
    readonly payload: Uint8Array,
    readonly mask?: Uint8Array<4>
  ) {
    this.length = new Length(this.payload.length);
  }

  static from(params: {
    final: boolean;
    opcode: number;
    payload: Uint8Array;
    mask?: Uint8Array<4>;
  }) {
    return new WebSocketFrame(
      params.final,
      params.opcode,
      params.payload,
      params.mask
    );
  }

  /**
   * Size as bits
   * @returns bits
   */
  sizeOrThrow() {
    return (
      0 +
      1 + // FIN
      3 + // RSV
      4 + // opcode
      1 + // MASK
      this.length.sizeOrThrow() +
      (this.mask == null ? 0 : this.mask.length * 8) +
      this.payload.length * 8
    );
  }

  /**
   * Write as bits
   * @param cursor bits
   */
  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(Number(this.final));

    cursor.writeUint8OrThrow(0);
    cursor.writeUint8OrThrow(0);
    cursor.writeUint8OrThrow(0);

    const opcodeBytesCursor = new Cursor(Bytes.alloc(1));
    opcodeBytesCursor.writeUint8OrThrow(this.opcode);

    using opcodeBytesMemory = new BitwiseWasm.Memory(opcodeBytesCursor.bytes);
    using opcodeBitsMemory = bitwise_unpack(opcodeBytesMemory);

    cursor.writeOrThrow(opcodeBitsMemory.bytes.subarray(4)); // 8 - 4

    const masked = Boolean(this.mask);
    cursor.writeUint8OrThrow(Number(masked));

    this.length.writeOrThrow(cursor);

    if (this.mask != null) {
      using maskBytesMemory = new BitwiseWasm.Memory(this.mask);
      using maskBitsMemory = bitwise_unpack(maskBytesMemory);
      cursor.writeOrThrow(maskBitsMemory.bytes);

      using xoredBytesMemory = new BitwiseWasm.Memory(this.payload);
      bitwise_xor_mod(xoredBytesMemory, maskBytesMemory);

      using xoredBitsMemory = bitwise_unpack(xoredBytesMemory);
      cursor.writeOrThrow(xoredBitsMemory.bytes);

      return;
    }

    using payloadBytesMemory = new BitwiseWasm.Memory(this.payload);
    using payloadBitsMemory = bitwise_unpack(payloadBytesMemory);
    cursor.writeOrThrow(payloadBitsMemory.bytes);
  }

  /**
   * Read from bits
   * @param cursor bits
   * @returns
   */
  static readOrThrow(cursor: Cursor) {
    const final = Boolean(cursor.readUint8OrThrow());

    cursor.offset += 3;

    const opcode = cursor.readOrThrow(4).reduce((p, n) => (p << 1) | n);

    const masked = Boolean(cursor.readUint8OrThrow());

    const length = Length.readOrThrow(cursor);

    if (cursor.remaining < length.value) throw ReadUnderflowError.from(cursor);

    if (masked) {
      const maskBitsBytes = cursor.readOrThrow(4 * 8);
      using maskBitsMemory = new BitwiseWasm.Memory(maskBitsBytes);
      using maskBytesMemory = bitwise_pack_left(maskBitsMemory);

      const xoredBitsBytes = cursor.readOrThrow(length.value * 8);
      using xoredBitsMemory = new BitwiseWasm.Memory(xoredBitsBytes);
      using xoredBytesMemory = bitwise_pack_left(xoredBitsMemory);

      bitwise_xor_mod(xoredBytesMemory, maskBytesMemory);

      const mask = maskBytesMemory.bytes.slice() as Uint8Array<4>;
      const payload = xoredBytesMemory.bytes.slice();

      return WebSocketFrame.from({ final, opcode, payload, mask });
    }

    const payloadBitsBytes = cursor.readOrThrow(length.value * 8);
    using payloadBitsMemory = new BitwiseWasm.Memory(payloadBitsBytes);
    using payloadBytesMemory = bitwise_pack_left(payloadBitsMemory);

    const payload = payloadBytesMemory.bytes.slice();

    return WebSocketFrame.from({ final, opcode, payload });
  }
}
