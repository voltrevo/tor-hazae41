import { Cursor } from '@hazae41/cursor';
import { Handshake } from '../../../../../mods/binary/records/handshakes/handshake.js';

export class ServerHelloDone2 {
  static readonly type = Handshake.types.server_hello_done;

  sizeOrThrow() {
    return 0;
  }

  writeOrThrow(cursor: Cursor) {
    return;
  }

  static readOrThrow(cursor: Cursor) {
    return new ServerHelloDone2();
  }
}
