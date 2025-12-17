import { Writable } from '../../../../binary/mod.ts';
import { Length } from '../../length/length.ts';
import { Triplet } from '../triplet.ts';
import { Type } from '../../type/type.ts';

export interface DERTriplet extends Triplet, Writable {
  readonly type: Type.DER;
}

export namespace DERTriplet {
  export function sizeOrThrow(length: Length.DER) {
    return Type.DER.size + length.sizeOrThrow() + length.value;
  }
}
