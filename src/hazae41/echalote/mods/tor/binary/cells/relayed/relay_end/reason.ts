import { Cursor } from '../../../../../../../cursor/mod';
import { Dates } from '../../../../../../../common/Dates';
import { Address4, Address6 } from '../../../address';

export type RelayEndReason = RelayEndReasonExitPolicy | RelayEndReasonOther;

export class RelayEndReasonOther {
  constructor(readonly id: number) {}

  sizeOrThrow() {
    return 0;
  }

  writeOrThrow(_cursor: Cursor) {
    return;
  }
}

export class RelayEndReasonExitPolicy {
  readonly #class = RelayEndReasonExitPolicy;

  static readonly id = 4;

  constructor(
    readonly address: Address4 | Address6,
    readonly ttl: Date
  ) {}

  get id() {
    return this.#class.id;
  }

  sizeOrThrow() {
    return this.address.sizeOrThrow() + 4;
  }

  writeOrThrow(cursor: Cursor) {
    this.address.writeOrThrow(cursor);
    const ttlv = Dates.toSecondsDelay(this.ttl);
    cursor.writeUint32OrThrow(ttlv);
  }

  static readOrThrow(cursor: Cursor) {
    const address =
      cursor.remaining === 8
        ? Address4.readOrThrow(cursor)
        : Address6.readOrThrow(cursor);

    const ttlv = cursor.readUint32OrThrow();
    const ttl = Dates.fromSecondsDelay(ttlv);

    return new RelayEndReasonExitPolicy(address, ttl);
  }
}
