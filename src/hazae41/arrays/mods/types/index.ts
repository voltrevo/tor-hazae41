export type ArrayLike<T, N extends number = number> = number extends N
  ? globalThis.ArrayLike<T>
  : globalThis.ArrayLike<T> & { readonly length: N }

export type Array<T, N extends number = number> = number extends N
  ? globalThis.Array<T>
  : globalThis.Array<T> & { readonly length: N }