import { DERCursor } from '../../../asn1/index';

export interface Resolvable<T> {
  resolveOrThrow(cursor: DERCursor): T;
}

export class ResolveError extends Error {
  readonly #class = ResolveError;
  readonly name = this.#class.name;

  constructor(options: ErrorOptions) {
    super(`Could not resolve`, options);
  }

  static from(cause: unknown) {
    return new ResolveError({ cause });
  }
}

export function resolveOrThrow<T>(
  resolvable: Resolvable<T>,
  cursor: DERCursor
): T {
  return resolvable.resolveOrThrow(cursor);
}
