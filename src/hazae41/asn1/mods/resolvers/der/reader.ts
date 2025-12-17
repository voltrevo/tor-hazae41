import { Cursor } from '../../../../cursor/mod';
import { OpaqueTriplet } from '../../triplets/opaque/opaque';

export namespace DER {
  export function readOrThrow(cursor: Cursor) {
    return OpaqueTriplet.DER.readOrThrow(cursor).resolveOrThrow();
  }
}
