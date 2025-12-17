export type Uint8Array<
  T extends ArrayBufferLike = ArrayBufferLike,
  N extends number = number,
> = globalThis.Uint8Array<T> & Lengthed<N> & ByteLengthed<N>;

export interface Lengthed<N extends number = number> {
  readonly length: N;
}

export interface ByteLengthed<N extends number = number> {
  readonly byteLength: N;
}
