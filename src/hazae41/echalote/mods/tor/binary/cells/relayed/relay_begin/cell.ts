import { Cursor } from '../../../../../../../cursor/mod';
import { Bytes } from '../../../../../../../bytes';

export class RelayBeginCell {
  readonly #class = RelayBeginCell;

  static readonly early = false;
  static readonly stream = true;
  static readonly rcommand = 1;

  static readonly flags = {
    IPV6_OK: 0,
    IPV4_NOT_OK: 1,
    IPV6_PREFER: 2,
  } as const;

  private constructor(
    readonly address: string,
    readonly bytes: Bytes,
    readonly flags: number
  ) {}

  static create(address: string, flags: number) {
    return new RelayBeginCell(address, Bytes.encodeUtf8(address), flags);
  }

  get early(): false {
    return this.#class.early;
  }

  get stream(): true {
    return this.#class.stream;
  }

  get rcommand() {
    return this.#class.rcommand;
  }

  sizeOrThrow() {
    return this.bytes.length + 1 + 4;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeNulledOrThrow(this.bytes);
    cursor.writeUint32OrThrow(this.flags);
  }

  static readOrThrow(cursor: Cursor) {
    const bytes = Bytes.from(cursor.readNulledOrThrow());
    const address = Bytes.decodeUtf8(bytes);
    const flags = cursor.readUint32OrThrow();

    return new RelayBeginCell(address, bytes, flags);
  }
}
