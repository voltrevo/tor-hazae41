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
    // see torspec/attic/text_formats/rend-spec-v3.txt section [TIME-PERIODS]
    // Time periods start at the Unix epoch (Jan 1, 1970), and are computed by
    // taking the number of minutes since the epoch and dividing by the time
    // period. However, we want our time periods to start at a regular offset
    // from the SRV voting schedule, so we subtract a "rotation time offset"
    // of 12 voting periods from the number of minutes since the epoch, before
    // dividing by the time period (effectively making "our" epoch start at Jan
    // 1, 1970 12:00UTC when the voting period is 1 hour.)

    const validAfter = this.consensus.validAfter;
    const secondsSinceEpoch = Math.floor(validAfter.getTime() / 1000);
    const minutesSinceEpoch = Math.floor(secondsSinceEpoch / 60);

    // Calculate voting period in minutes from consensus timestamps
    // In production, this is typically 60 minutes (1 hour)
    const freshUntil = this.consensus.freshUntil;
    const votingPeriodMinutes = Math.floor(
      (freshUntil.getTime() - validAfter.getTime()) / (1000 * 60)
    );

    const rotationTimeOffset = 12 * votingPeriodMinutes; // 12 voting periods
    const adjustedMinutes = minutesSinceEpoch - rotationTimeOffset;
    const periodLength = this.periodLength();

    return Math.floor(adjustedMinutes / periodLength);
  }

  sharedRandomValue(): Uint8Array {
    return Base64.get()
      .getOrThrow()
      .decodePaddedOrThrow(this.consensus.sharedRandCurrentValue.random)
      .bytes.slice();
  }

  async serviceIndex(replicaNum: number, blindedPublicKey: Uint8Array) {
    return await hash(
      'store-at-idx',
      blindedPublicKey,
      replicaNum,
      this.periodLength(),
      this.periodNum()
    );
  }

  async relayIndex(nodeIdentity: Uint8Array) {
    return await hash(
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
