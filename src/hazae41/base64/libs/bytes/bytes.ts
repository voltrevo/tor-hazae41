export namespace Bytes {

  export function fromView<T extends ArrayBufferLike>(view: ArrayBufferView<T>) {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  }

}