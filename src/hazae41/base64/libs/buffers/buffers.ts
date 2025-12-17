export namespace Buffers {

  export function fromView<T extends ArrayBufferLike>(view: ArrayBufferView<T>) {
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength)
  }

}