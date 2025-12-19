import { Empty, Writable, Unknown } from '../../../../binary/mod';
import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor';

export class SmuxUpdate {
  constructor(
    readonly consumed: number,
    readonly window: number
  ) {}

  sizeOrThrow() {
    return 4 + 4;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint32OrThrow(this.consumed, true);
    cursor.writeUint32OrThrow(this.window, true);
  }

  static readOrThrow(cursor: Cursor) {
    const consumed = cursor.readUint32OrThrow(true);
    const window = cursor.readUint32OrThrow(true);

    return new SmuxUpdate(consumed, window);
  }
}

export interface SmuxSegmentParams<Fragment extends Writable> {
  readonly version: number;
  readonly command: number;
  readonly stream: number;
  readonly fragment: Fragment;
}

export class SmuxSegment<Fragment extends Writable> {
  static readonly versions = {
    one: 1,
    two: 2,
  } as const;

  static readonly commands = {
    syn: 0,
    fin: 1,
    psh: 2,
    nop: 3,
    upd: 4,
  } as const;

  private constructor(
    readonly version: number,
    readonly command: number,
    readonly stream: number,
    readonly fragment: Fragment,
    readonly fragmentSize: number
  ) {}

  static empty(params: SmuxSegmentParams<Empty>) {
    const { version, command, stream, fragment } = params;
    return new SmuxSegment(version, command, stream, fragment, 0);
  }

  static newOrThrow<Fragment extends Writable>(
    params: SmuxSegmentParams<Fragment>
  ) {
    const { version, command, stream, fragment } = params;
    return new SmuxSegment(
      version,
      command,
      stream,
      fragment,
      fragment.sizeOrThrow()
    );
  }

  sizeOrThrow() {
    return 0 + 1 + 1 + 2 + 4 + this.fragmentSize;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.version);
    cursor.writeUint8OrThrow(this.command);
    cursor.writeUint16OrThrow(this.fragmentSize, true);
    cursor.writeUint32OrThrow(this.stream, true);

    this.fragment.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const version = cursor.readUint8OrThrow();
    const command = cursor.readUint8OrThrow();
    const length = cursor.readUint16OrThrow(true);
    const stream = cursor.readUint32OrThrow(true);
    const bytes = Bytes.from(cursor.readOrThrow(length));
    const fragment = new Unknown(bytes);

    return SmuxSegment.newOrThrow({ version, command, stream, fragment });
  }
}
