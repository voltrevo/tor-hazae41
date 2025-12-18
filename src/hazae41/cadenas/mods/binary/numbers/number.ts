import { Readable } from '../../../../binary/mod.js';
import { Number16 } from './number16.js';
import { Number24 } from './number24.js';
import { Number8 } from './number8.js';

export type NumberX = Number8 | Number16 | Number24;

export interface NumberClass<T> extends Readable<T> {
  readonly size: number;
  new (value: number): T;
}
