import { Cursor } from '../../../../cursor';
import { OpaqueTriplet } from '../../triplets/opaque/opaque';

export namespace DER {
  export function readOrThrow(cursor: Cursor) {
    return OpaqueTriplet.DER.readOrThrow(cursor).resolveOrThrow();
  }
}
