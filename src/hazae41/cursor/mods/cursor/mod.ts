import { Data } from '../../libs/dataviews/mod.ts';
import type { Uint8Array } from '../../libs/lengthed/mod.ts';

export type CursorError = CursorReadError | CursorWriteError;

export type CursorReadError = CursorReadOverflowError | CursorReadUnknownError;

export type CursorReadOverflowError =
  | CursorReadLengthOverflowError
  | CursorReadNullOverflowError;

export type CursorWriteError =
  | CursorWriteLengthOverflowError
  | CursorWriteUnknownError;

export class CursorReadLengthOverflowError extends Error {
  readonly #class = CursorReadLengthOverflowError;
  readonly name: string = this.#class.name;

  constructor(
    readonly cursorOffset: number,
    readonly cursorLength: number,
    readonly bytesLength: number
  ) {
    super(
      `Overflow reading ${bytesLength} bytes at offset ${cursorOffset}/${cursorLength}`
    );
  }

  static from(
    cursor: Cursor,
    bytesLength: number
  ): CursorReadLengthOverflowError {
    return new CursorReadLengthOverflowError(
      cursor.offset,
      cursor.length,
      bytesLength
    );
  }
}

export class CursorWriteLengthOverflowError extends Error {
  readonly #class = CursorWriteLengthOverflowError;
  readonly name: string = this.#class.name;

  constructor(
    readonly cursorOffset: number,
    readonly cursorLength: number,
    readonly bytesLength: number
  ) {
    super(
      `Overflow writing ${bytesLength} bytes at offset ${cursorOffset}/${cursorLength}`
    );
  }

  static from(
    cursor: Cursor,
    bytesLength: number
  ): CursorWriteLengthOverflowError {
    return new CursorWriteLengthOverflowError(
      cursor.offset,
      cursor.length,
      bytesLength
    );
  }
}

export class CursorReadNullOverflowError extends Error {
  readonly #class = CursorReadNullOverflowError;
  readonly name: string = this.#class.name;

  constructor(
    readonly cursorOffset: number,
    readonly cursorLength: number
  ) {
    super(
      `Overflow reading null byte at offset ${cursorOffset}/${cursorLength}`
    );
  }

  static from(cursor: Cursor): CursorReadNullOverflowError {
    return new CursorReadNullOverflowError(cursor.offset, cursor.length);
  }
}

export class CursorReadUnknownError extends Error {
  readonly #class = CursorReadUnknownError;
  readonly name: string = this.#class.name;
}

export class CursorWriteUnknownError extends Error {
  readonly #class = CursorWriteUnknownError;
  readonly name: string = this.#class.name;
}

export class Cursor<
  T extends ArrayBufferLike = ArrayBufferLike,
  N extends number = number,
> {
  readonly data: DataView<T>;

  offset = 0;

  /**
   * A cursor for bytes
   * @param inner
   * @param offset
   */
  constructor(readonly bytes: Uint8Array<T, N>) {
    this.data = Data.fromView(bytes);
  }

  /**
   * @returns total number of bytes
   */
  get length(): N {
    return this.bytes.length;
  }

  /**
   * @returns number of remaining bytes
   */
  get remaining(): number {
    return this.length - this.offset;
  }

  /**
   * Get a subarray of the bytes before the current offset
   * @returns subarray of the bytes before the current offset
   */
  get before(): Uint8Array<T> {
    return this.bytes.subarray(0, this.offset);
  }

  /**
   * Get a subarray of the bytes after the current offset
   * @returns subarray of the bytes after the current offset
   */
  get after(): Uint8Array<T> {
    return this.bytes.subarray(this.offset);
  }

  /**
   * Get a subarray of the bytes
   * @param length
   * @returns subarray of the bytes
   */
  getOrThrow<N extends number>(length: N): Uint8Array<T, N> {
    if (this.remaining < length)
      throw CursorReadLengthOverflowError.from(this, length);

    const subarray = this.bytes.subarray(this.offset, this.offset + length);

    return subarray as Uint8Array<T, N>;
  }

  /**
   * Read a subarray of the bytes
   * @param length
   * @returns subarray of the bytes
   */
  readOrThrow<N extends number>(length: N): Uint8Array<T, N> {
    const subarray = this.getOrThrow(length);
    this.offset += length;
    return subarray;
  }

  /**
   * Set an array to the bytes
   * @param array array
   */
  setOrThrow(array: Uint8Array): void {
    if (this.remaining < array.length)
      throw CursorWriteLengthOverflowError.from(this, array.length);

    this.bytes.set(array, this.offset);
  }

  /**
   * Write an array to the bytes
   * @param array array
   */
  writeOrThrow(array: Uint8Array): void {
    this.setOrThrow(array);
    this.offset += array.length;
  }

  getUint8OrThrow(): number {
    return this.data.getUint8(this.offset);
  }

  readUint8OrThrow(): number {
    const x = this.getUint8OrThrow();
    this.offset++;
    return x;
  }

  setUint8OrThrow(x: number): void {
    this.data.setUint8(this.offset, x);
  }

  writeUint8OrThrow(x: number): void {
    this.setUint8OrThrow(x);
    this.offset++;
  }

  getInt8OrThrow(): number {
    return this.data.getInt8(this.offset);
  }

  readInt8OrThrow(): number {
    const x = this.getInt8OrThrow();
    this.offset++;
    return x;
  }

  setInt8OrThrow(x: number): void {
    this.data.setInt8(this.offset, x);
  }

  writeInt8OrThrow(x: number): void {
    this.setInt8OrThrow(x);
    this.offset++;
  }

  getUint16OrThrow(littleEndian?: boolean): number {
    return this.data.getUint16(this.offset, littleEndian);
  }

  readUint16OrThrow(littleEndian?: boolean): number {
    const x = this.getUint16OrThrow(littleEndian);
    this.offset += 2;
    return x;
  }

  setUint16OrThrow(x: number, littleEndian?: boolean): void {
    this.data.setUint16(this.offset, x, littleEndian);
  }

  writeUint16OrThrow(x: number, littleEndian?: boolean): void {
    this.setUint16OrThrow(x, littleEndian);
    this.offset += 2;
  }

  getInt16OrThrow(littleEndian?: boolean): number {
    return this.data.getInt16(this.offset, littleEndian);
  }

  readInt16OrThrow(littleEndian?: boolean): number {
    const x = this.getInt16OrThrow(littleEndian);
    this.offset += 2;
    return x;
  }

  setInt16OrThrow(x: number, littleEndian?: boolean): void {
    this.data.setInt16(this.offset, x, littleEndian);
  }

  writeInt16OrThrow(x: number, littleEndian?: boolean): void {
    this.setInt16OrThrow(x, littleEndian);
    this.offset += 2;
  }

  getUint24OrThrow(littleEndian?: boolean): number {
    if (littleEndian) {
      return (
        this.bytes[this.offset] |
        (this.bytes[this.offset + 1] << 8) |
        (this.bytes[this.offset + 2] << 16)
      );
    } else {
      return (
        (this.bytes[this.offset] << 16) |
        (this.bytes[this.offset + 1] << 8) |
        this.bytes[this.offset + 2]
      );
    }
  }

  readUint24OrThrow(littleEndian?: boolean): number {
    const x = this.getUint24OrThrow(littleEndian);
    this.offset += 3;
    return x;
  }

  setUint24OrThrow(x: number, littleEndian?: boolean): void {
    if (littleEndian) {
      this.bytes[this.offset] = x & 0xff;
      this.bytes[this.offset + 1] = (x >> 8) & 0xff;
      this.bytes[this.offset + 2] = (x >> 16) & 0xff;
    } else {
      this.bytes[this.offset] = (x >> 16) & 0xff;
      this.bytes[this.offset + 1] = (x >> 8) & 0xff;
      this.bytes[this.offset + 2] = x & 0xff;
    }
  }

  writeUint24OrThrow(x: number, littleEndian?: boolean): void {
    this.setUint24OrThrow(x, littleEndian);
    this.offset += 3;
  }

  getUint32OrThrow(littleEndian?: boolean): number {
    return this.data.getUint32(this.offset, littleEndian);
  }

  readUint32OrThrow(littleEndian?: boolean): number {
    const x = this.getUint32OrThrow(littleEndian);
    this.offset += 4;
    return x;
  }

  setUint32OrThrow(x: number, littleEndian?: boolean): void {
    this.data.setUint32(this.offset, x, littleEndian);
  }

  writeUint32OrThrow(x: number, littleEndian?: boolean): void {
    this.setUint32OrThrow(x, littleEndian);
    this.offset += 4;
  }

  getInt32OrThrow(littleEndian?: boolean): number {
    return this.data.getInt32(this.offset, littleEndian);
  }

  readInt32OrThrow(littleEndian?: boolean): number {
    const x = this.getInt32OrThrow(littleEndian);
    this.offset += 4;
    return x;
  }

  setInt32OrThrow(x: number, littleEndian?: boolean): void {
    this.data.setInt32(this.offset, x, littleEndian);
  }

  writeInt32OrThrow(x: number, littleEndian?: boolean): void {
    this.setInt32OrThrow(x, littleEndian);
    this.offset += 4;
  }

  getBigUint64OrThrow(littleEndian?: boolean): bigint {
    return this.data.getBigUint64(this.offset, littleEndian);
  }

  readBigUint64OrThrow(littleEndian?: boolean): bigint {
    const x = this.getBigUint64OrThrow(littleEndian);
    this.offset += 8;
    return x;
  }

  setBigUint64OrThrow(x: bigint, littleEndian?: boolean): void {
    this.data.setBigUint64(this.offset, x, littleEndian);
  }

  writeBigUint64OrThrow(x: bigint, littleEndian?: boolean): void {
    this.setBigUint64OrThrow(x, littleEndian);
    this.offset += 8;
  }

  getBigInt64OrThrow(littleEndian?: boolean): bigint {
    return this.data.getBigInt64(this.offset, littleEndian);
  }

  readBigInt64OrThrow(littleEndian?: boolean): bigint {
    const x = this.getBigInt64OrThrow(littleEndian);
    this.offset += 8;
    return x;
  }

  setBigInt64OrThrow(x: bigint, littleEndian?: boolean): void {
    this.data.setBigInt64(this.offset, x, littleEndian);
  }

  writeBigInt64OrThrow(x: bigint, littleEndian?: boolean): void {
    this.setBigInt64OrThrow(x, littleEndian);
    this.offset += 8;
  }

  getFloat16OrThrow(littleEndian?: boolean): number {
    return this.data.getFloat16(this.offset, littleEndian);
  }

  readFloat16OrThrow(littleEndian?: boolean): number {
    const x = this.getFloat16OrThrow(littleEndian);
    this.offset += 2;
    return x;
  }

  setFloat16OrThrow(x: number, littleEndian?: boolean): void {
    this.data.setFloat16(this.offset, x, littleEndian);
  }

  writeFloat16OrThrow(x: number, littleEndian?: boolean): void {
    this.setFloat16OrThrow(x, littleEndian);
    this.offset += 2;
  }

  getFloat32OrThrow(littleEndian?: boolean): number {
    return this.data.getFloat32(this.offset, littleEndian);
  }

  readFloat32OrThrow(littleEndian?: boolean): number {
    const x = this.getFloat32OrThrow(littleEndian);
    this.offset += 4;
    return x;
  }

  setFloat32OrThrow(x: number, littleEndian?: boolean): void {
    this.data.setFloat32(this.offset, x, littleEndian);
  }

  writeFloat32OrThrow(x: number, littleEndian?: boolean): void {
    this.setFloat32OrThrow(x, littleEndian);
    this.offset += 4;
  }

  getFloat64OrThrow(littleEndian?: boolean): number {
    return this.data.getFloat64(this.offset, littleEndian);
  }

  readFloat64OrThrow(littleEndian?: boolean): number {
    const x = this.getFloat64OrThrow(littleEndian);
    this.offset += 8;
    return x;
  }

  setFloat64OrThrow(x: number, littleEndian?: boolean): void {
    this.data.setFloat64(this.offset, x, littleEndian);
  }

  writeFloat64OrThrow(x: number, littleEndian?: boolean): void {
    this.setFloat64OrThrow(x, littleEndian);
    this.offset += 8;
  }
}
