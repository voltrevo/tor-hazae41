import { Bytes } from '../../../bytes';

export type BytesOrCopiable<T extends Bytes = Bytes> = T | Copiable<T>;

export interface Copiable<T extends Bytes = Bytes> extends Disposable {
  readonly bytes: T;
}

export class Copied<T extends Bytes = Bytes> implements Copiable<T> {
  constructor(readonly bytes: T) {}

  [Symbol.dispose]() {}
}

export namespace Copiable {
  export function copyAndDispose(copiable: Copiable): Bytes {
    using _ = copiable;

    return copiable.bytes.slice();
  }
}
