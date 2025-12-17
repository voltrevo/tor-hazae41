import type { Nullable } from '../../../libs/nullable/mod';
import { Cursor } from '../../../../cursor/mod';
import { Bytes } from '../../../../bytes';

export type ReadError = ReadUnderflowError | ReadUnknownError;

export class ReadUnknownError extends Error {
  readonly #class = ReadUnknownError;
  readonly name: string = this.#class.name;

  constructor(options: ErrorOptions) {
    super(`Could not read`, options);
  }

  static from(cause: unknown): ReadUnknownError {
    return new ReadUnknownError({ cause });
  }
}

export class ReadUnderflowError extends Error {
  readonly #class = ReadUnderflowError;
  readonly name: string = this.#class.name;

  constructor(
    readonly cursorOffset: number,
    readonly cursorLength: number
  ) {
    super(
      `Cursor has ${cursorLength - cursorOffset} remaining bytes after read`
    );
  }

  static from(cursor: Cursor): ReadUnderflowError {
    return new ReadUnderflowError(cursor.offset, cursor.length);
  }
}

/**
 * A readable binary data type
 */
export interface Readable<Output = unknown> {
  /**
   * Read from a cursor
   * @param cursor
   */
  readOrThrow(cursor: Cursor): Output;
}

export namespace Readable {
  export type Infer<Self, Output = unknown> = Readable<
    Output & Readable.Output<Self>
  >;

  export type Output<Self> =
    Self extends Readable<infer Output> ? Output : never;

  /**
   * Call readOrThrow() but rollback the cursor on error
   * @throws whatever readOrThrow() throws
   * @param readable
   * @param cursor
   * @returns
   */
  export function readOrRollbackAndThrow<T extends Readable.Infer<T>>(
    readable: T,
    cursor: Cursor
  ): Readable.Output<T> {
    const offset = cursor.offset;

    try {
      return readable.readOrThrow(cursor);
    } catch (e: unknown) {
      cursor.offset = offset;
      throw e;
    }
  }

  /**
   * Call readOrThrow() on the given bytes and check for underflow
   * @param readable
   * @param bytes
   * @returns
   */
  export function readFromBytesOrNull<T extends Readable.Infer<T>>(
    readable: T,
    bytes: Bytes
  ): Nullable<Readable.Output<T>> {
    try {
      const cursor = new Cursor(bytes);
      const output = readable.readOrThrow(cursor);

      if (cursor.remaining) return undefined;

      return output;
    } catch (e: unknown) {
      return;
    }
  }

  /**
   * Call readOrThrow() on the given bytes and check for underflow
   * @throws whatever readOrThrow() throws
   * @throws ReadUnderflowError on underflow
   * @param readable
   * @param bytes
   * @returns
   */
  export function readFromBytesOrThrow<T extends Readable.Infer<T>>(
    readable: T,
    bytes: Bytes
  ): Readable.Output<T> {
    const cursor = new Cursor(bytes);
    const output = readable.readOrThrow(cursor);

    if (cursor.remaining) throw ReadUnderflowError.from(cursor);

    return output;
  }
}
