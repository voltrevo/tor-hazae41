import { Cursor } from '../../../../../../../cursor/mod';
import { DestroyCell } from '../../direct/destroy/cell';

export class RelayTruncateCell {
  readonly #class = RelayTruncateCell;

  static readonly early = false;
  static readonly stream = false;
  static readonly rcommand = 8;

  static readonly reasons = DestroyCell.reasons;

  constructor(readonly reason: number) {}

  get early(): false {
    return this.#class.early;
  }

  get stream(): false {
    return this.#class.stream;
  }

  get rcommand(): 8 {
    return this.#class.rcommand;
  }

  sizeOrThrow() {
    return 1;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.reason);
  }

  static readOrThrow(cursor: Cursor) {
    return new RelayTruncateCell(cursor.readUint8OrThrow());
  }
}
