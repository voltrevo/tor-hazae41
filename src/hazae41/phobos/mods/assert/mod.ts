export class AssertError extends Error {
  readonly #class = AssertError

  override readonly name: string = this.#class.name

}

/**
 * Just an assert function
 * @param condition should be true
 * @param message message to throw if condition is false
 */
export function assert(condition: boolean, message = "Expected condition to be true"): asserts condition {
  if (!condition) throw new AssertError(message)
}
