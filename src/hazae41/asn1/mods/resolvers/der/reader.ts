import { Cursor } from '../../../../cursor/mod';
import { Opaque } from '../../triplets/opaque/opaque';

export namespace DER {
  export function readOrThrow(cursor: Cursor) {
    return Opaque.DER.readOrThrow(cursor).resolveOrThrow();
  }
}
