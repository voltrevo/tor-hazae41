export namespace Bytes {
  export function fromView<T extends ArrayBufferLike>(
    view: ArrayBufferView<T>
  ): Uint8Array<T> {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
}
