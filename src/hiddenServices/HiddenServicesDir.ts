import { Base64 } from '@hazae41/base64';
import { Consensus } from '../echalote/index.js';
import { hash } from './hash.js';

export class HiddenServicesDir {
  constructor(public consensus: Consensus) {}

  nReplicas() {
    return asInt(this.consensus.params['hsdir_n_replicas'], 2);
  }

  spreadFetch() {
    return asInt(this.consensus.params['hsdir_spread_fetch'], 3);
  }

  spreadStore() {
    return asInt(this.consensus.params['hsdir_spread_store'], 4);
  }

  interval() {
    return asInt(this.consensus.params['hsdir_interval'], 1440);
  }

  periodLength(): number {
    return this.interval();
  }

  periodNum(): number {
    throw new Error('todo');
  }

  sharedRandomValue(): Uint8Array {
    return Base64.get()
      .getOrThrow()
      .decodePaddedOrThrow(this.consensus.sharedRandCurrentValue.random)
      .bytes.slice();
  }

  serviceIndex(replicaNum: number, blindedPublicKey: Uint8Array) {
    return hash(
      'store-at-idx',
      blindedPublicKey,
      replicaNum,
      this.periodLength(),
      this.periodNum()
    );
  }

  relayIndex(nodeIdentity: Uint8Array) {
    return hash(
      'node-idx',
      nodeIdentity,
      this.sharedRandomValue(),
      this.periodNum(),
      this.periodLength()
    );
  }
}

function asInt(s: string | undefined, default_: number) {
  if (s === undefined) {
    return default_;
  }

  if (!/^[0-9]+$/.test(s)) {
    throw new Error(`Expected int: ${s}`);
  }

  return Number(s);
}
