import { Bytes } from '../../bytes';
import { Cursor } from '../../cursor/mod';

export type WriteError =
  | SizeUnknownError
  | WriteUnderflowError
  | WriteUnknownError;

export class SizeUnknownError extends Error {
  readonly #class = SizeUnknownError;
  readonly name: string = this.#class.name;

  constructor(options: ErrorOptions) {
    super(`Could not size`, options);
  }

  static from(cause: unknown): SizeUnknownError {
    return new SizeUnknownError({ cause });
  }
}

export class WriteUnknownError extends Error {
  readonly #class = WriteUnderflowError;
  readonly name: string = this.#class.name;

  constructor(options: ErrorOptions) {
    super(`Could not write`, options);
  }

  static from(cause: unknown): WriteUnknownError {
    return new WriteUnknownError({ cause });
  }
}

export class WriteUnderflowError extends Error {
  readonly #class = WriteUnderflowError;
  readonly name: string = this.#class.name;

  constructor(
    readonly cursorOffset: number,
    readonly cursorLength: number
  ) {
    super(
      `Cursor has ${cursorLength - cursorOffset} remaining bytes after write`
    );
  }

  static from(cursor: Cursor): WriteUnderflowError {
    return new WriteUnderflowError(cursor.offset, cursor.length);
  }
}

/**
 * A writable binary data type
 */
export interface Writable {
  /**
   * Compute the amount of bytes to allocate
   */
  sizeOrThrow(): number;

  /**
   * Write to a cursor
   * @param cursor
   */
  writeOrThrow(cursor: Cursor): void;
}

export namespace Writable {
  /**
   * Call writeOrThrow() on sizeOrThrow()-sized bytes and check for underflow
   * @throws whatever sizeOrThrow() or writeOrThrow() throws
   * @param writable
   * @returns
   */
  export function writeToBytesOrThrow(writable: Writable): Bytes {
    const size = writable.sizeOrThrow();

    const bytes = Bytes.alloc(size);
    const cursor = new Cursor(bytes);

    writable.writeOrThrow(cursor);

    if (cursor.remaining) throw WriteUnderflowError.from(cursor);

    return bytes;
  }
}
