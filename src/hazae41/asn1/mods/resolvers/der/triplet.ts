import { Writable } from '../../../../binary/mod';
import { Length } from '../../length/length';
import { Triplet } from '../triplet';
import { Type } from '../../type/type';

export interface DERTriplet extends Triplet, Writable {
  readonly type: Type.DER;
}

export namespace DERTriplet {
  export function sizeOrThrow(length: Length.DER) {
    return Type.DER.size + length.sizeOrThrow() + length.value;
  }
}
