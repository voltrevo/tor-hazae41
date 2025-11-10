export type HttpError =
  | InvalidHttpStateError
  | UnsupportedContentEncoding
  | UnsupportedTransferEncoding
  | ContentLengthOverflowError

export class InvalidHttpStateError extends Error {
  readonly #class = InvalidHttpStateError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid state`)
  }

}

export class UnsupportedContentEncoding extends Error {
  readonly #class = UnsupportedContentEncoding
  readonly name = this.#class.name

  constructor(
    readonly type: string
  ) {
    super(`Unsupported "Content-Encoding" header value "${type}"`)
  }

}

export class UnsupportedTransferEncoding extends Error {
  readonly #class = UnsupportedTransferEncoding
  readonly name = this.#class.name

  constructor(
    readonly type: string
  ) {
    super(`Unsupported "Transfer-Encoding" header value "${type}"`)
  }
}

export class ContentLengthOverflowError extends Error {
  readonly #class = ContentLengthOverflowError
  readonly name = this.#class.name

  constructor(
    readonly offset: number,
    readonly length: number
  ) {
    super(`Received ${offset} bytes but "Content-Length" header said it was ${length} bytes`)
  }

}