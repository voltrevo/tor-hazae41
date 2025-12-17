import { Empty, Writable } from '../../../../binary/mod';
import { Cursor } from '../../../../cursor/mod';

export interface KcpSegmentParams<Fragment extends Writable> {
  readonly conversation: number;
  readonly command: number;
  readonly count?: number;
  readonly window?: number;
  readonly timestamp?: number;
  readonly serial: number;
  readonly unackSerial: number;
  readonly fragment: Fragment;
}

export class KcpSegment<Fragment extends Writable> {
  static readonly commands = {
    push: 81,
    ack: 82,
    wask: 83,
    wins: 84,
  } as const;

  private constructor(
    /**
     * conv
     */
    readonly conversation: number,
    /**
     * cmd
     */
    readonly command: number,
    /**
     * frg
     */
    readonly count = 0,
    /**
     * wnd
     */
    readonly window = 65535,
    /**
     * ts
     */
    readonly timestamp = Math.ceil(Date.now() / 1000),
    /**
     * sn
     */
    readonly serial: number,
    /**
     * una
     */
    readonly unackSerial: number,
    /**
     * data
     */
    readonly fragment: Fragment,
    /**
     * data size
     */
    readonly fragmentSize: number
  ) {}

  static empty(params: KcpSegmentParams<Empty>) {
    const {
      conversation,
      command,
      count,
      window,
      timestamp,
      serial,
      unackSerial,
      fragment,
    } = params;
    return new KcpSegment<Empty>(
      conversation,
      command,
      count,
      window,
      timestamp,
      serial,
      unackSerial,
      fragment,
      0
    );
  }

  static newOrThrow<Fragment extends Writable>(
    params: KcpSegmentParams<Fragment>
  ) {
    const {
      conversation,
      command,
      count,
      window,
      timestamp,
      serial,
      unackSerial,
      fragment,
    } = params;
    return new KcpSegment<Fragment>(
      conversation,
      command,
      count,
      window,
      timestamp,
      serial,
      unackSerial,
      fragment,
      fragment.sizeOrThrow()
    );
  }

  sizeOrThrow() {
    return 0 + 4 + 1 + 1 + 2 + 4 + 4 + 4 + 4 + this.fragmentSize;
  }

  writeOrThrow(cursor: Cursor<ArrayBuffer>) {
    cursor.writeUint32OrThrow(this.conversation, true);
    cursor.writeUint8OrThrow(this.command);
    cursor.writeUint8OrThrow(this.count);
    cursor.writeUint16OrThrow(this.window, true);
    cursor.writeUint32OrThrow(this.timestamp, true);
    cursor.writeUint32OrThrow(this.serial, true);
    cursor.writeUint32OrThrow(this.unackSerial, true);
    cursor.writeUint32OrThrow(this.fragmentSize, true);

    this.fragment.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor<ArrayBuffer>) {
    const conversation = cursor.readUint32OrThrow(true);
    const command = cursor.readUint8OrThrow();
    const count = cursor.readUint8OrThrow();
    const window = cursor.readUint16OrThrow(true);
    const timestamp = cursor.readUint32OrThrow(true);
    const serial = cursor.readUint32OrThrow(true);
    const unackSerial = cursor.readUint32OrThrow(true);
    const length = cursor.readUint32OrThrow(true);
    const bytes = new Uint8Array(cursor.readOrThrow(length));
    const fragment = new any(bytes);

    return KcpSegment.newOrThrow({
      conversation,
      command,
      count,
      window,
      timestamp,
      serial,
      unackSerial,
      fragment,
    });
  }
}
