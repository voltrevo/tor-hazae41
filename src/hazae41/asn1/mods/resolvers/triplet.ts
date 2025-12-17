import { DERTriplet } from './der/triplet';
import { Type } from '../type/type';

export interface Triplet {
  readonly type: Type;
  toDER(): DERTriplet;
  toString(): string;
}
