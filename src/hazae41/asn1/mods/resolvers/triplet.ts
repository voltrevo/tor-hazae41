import { DERTriplet } from './der/triplet.ts';
import { Type } from '../type/type.ts';

export interface Triplet {
  readonly type: Type;
  toDER(): DERTriplet;
  toString(): string;
}
