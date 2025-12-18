import { Cursor } from '../../../../../../cursor/mod.js';
import { Handshake } from '../handshake.js';

export class ServerHelloDone2 {
  static readonly type = Handshake.types.server_hello_done;

  sizeOrThrow() {
    return 0;
  }

  writeOrThrow(_cursor: Cursor) {
    return;
  }

  static readOrThrow(_cursor: Cursor) {
    return new ServerHelloDone2();
  }
}
