export class TestError extends Error {
  readonly #class = TestError

  override readonly name: string = this.#class.name

}

export namespace TestError {

  export function unroll(message: string, cause: unknown): TestError {
    while (cause instanceof TestError) {
      message = `${message} > ${cause.message}`

      cause = cause.cause
    }

    return new TestError(message, { cause })
  }

}