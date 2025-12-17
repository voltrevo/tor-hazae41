import { ReadUnderflowError } from '@hazae41/binary';
import { Cursor } from '@hazae41/cursor';
import { Length } from './length';
import {
  bitwise_pack_left,
  bitwise_unpack,
  bitwise_xor_mod,
} from '../../../utils/bitwise';
import { Bytes } from '../../../hazae41/bytes';

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
    readonly payload: Bytes,
    readonly mask?: Bytes<4>
  ) {
    this.length = new Length(this.payload.length);
  }

  static from(params: {
    final: boolean;
    opcode: number;
    payload: Bytes;
    mask?: Bytes<4>;
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

    cursor.writeOrThrow(bitwise_unpack(opcodeBytesCursor.bytes).subarray(4)); // 8 - 4

    const masked = Boolean(this.mask);
    cursor.writeUint8OrThrow(Number(masked));

    this.length.writeOrThrow(cursor);

    if (this.mask != null) {
      cursor.writeOrThrow(bitwise_unpack(this.mask));
      bitwise_xor_mod(this.payload, this.mask);
      cursor.writeOrThrow(bitwise_unpack(this.payload));

      return;
    }

    cursor.writeOrThrow(bitwise_unpack(this.payload));
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
      const maskBytesMemory = bitwise_pack_left(maskBitsBytes);

      const xoredBitsBytes = cursor.readOrThrow(length.value * 8);
      const xoredBytesMemory = bitwise_pack_left(xoredBitsBytes);

      bitwise_xor_mod(xoredBytesMemory, maskBytesMemory);

      const mask = maskBytesMemory.slice() as Bytes<4>;
      const payload = xoredBytesMemory.slice();

      return WebSocketFrame.from({ final, opcode, payload, mask });
    }

    const payloadBitsBytes = cursor.readOrThrow(length.value * 8);
    const payloadBytesMemory = bitwise_pack_left(payloadBitsBytes);

    const payload = payloadBytesMemory.slice();

    return WebSocketFrame.from({ final, opcode, payload });
  }
}
