export class Unimplemented extends Error {
  readonly #class = Unimplemented;
  readonly name = this.#class.name;

  constructor() {
    super(`Unimplemented`);
  }
}

export class InvalidFormatError extends Error {
  readonly #class = InvalidFormatError;
  readonly name = this.#class.name;
}
