export namespace Buffers {
  export function fromView(view: ArrayBufferView) {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
}
