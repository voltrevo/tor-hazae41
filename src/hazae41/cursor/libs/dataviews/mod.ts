export namespace Data {

  export function fromView<T extends ArrayBufferLike>(view: ArrayBufferView<T>): DataView<T> {
    return new DataView(view.buffer, view.byteOffset, view.byteLength)
  }

}