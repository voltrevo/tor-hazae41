import { Bytes } from '../../../bytes';

export namespace Buffers {
  export function fromView(view: ArrayBufferView<ArrayBuffer>): Bytes {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
}
