export type WebSocketHttpError = InvalidHttpHeaderValue | InvalidHttpStatusCode;

export class InvalidHttpStatusCode extends Error {
  readonly #class = InvalidHttpStatusCode;

  constructor(readonly status?: number) {
    super(`Invalid HTTP status code ${status}`);
  }
}

export class InvalidHttpHeaderValue extends Error {
  readonly #class = InvalidHttpStatusCode;

  constructor(readonly name: string) {
    super(`Invalid "${name}" header value`);
  }
}

export type WebSocketFrameError =
  | UnexpectedContinuationFrameError
  | ExpectedContinuationFrameError;

export class UnexpectedContinuationFrameError extends Error {
  readonly #class = UnexpectedContinuationFrameError;

  constructor() {
    super(`Did not expect a continuation frame`);
  }
}

export class ExpectedContinuationFrameError extends Error {
  readonly #class = ExpectedContinuationFrameError;
  readonly name = this.#class.name;

  constructor() {
    super(`Expected a continuation frame`);
  }
}
