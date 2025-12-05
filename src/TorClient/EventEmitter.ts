/**
 * Inlined from https://github.com/voltrevo/ee-typed
 * Simple typed event emitter wrapper around node's events module.
 *
 * @internal This is an internal utility and should not be used directly by external consumers.
 */

import { EventEmitter as NodeEventEmitter } from 'events';
import type { EventMap } from 'typed-emitter';
import type TypedEmitter from 'typed-emitter';

// Cast the node EventEmitter to support typed generics
export const EventEmitter = NodeEventEmitter as {
  new <T extends EventMap>(): TypedEmitter<T>;
};

export type { EventMap, TypedEmitter };
