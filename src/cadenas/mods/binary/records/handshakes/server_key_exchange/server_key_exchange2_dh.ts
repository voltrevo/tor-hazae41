import { Cursor } from '@hazae41/cursor';
import { Handshake } from '../../../../../mods/binary/records/handshakes/handshake.js';
import { ServerDHParams } from '../../../../../mods/binary/records/handshakes/server_key_exchange/server_dh_params.js';

export class ServerKeyExchange2DH {
  static readonly type = Handshake.types.server_key_exchange;

  constructor(readonly params: ServerDHParams) {}

  static new(params: ServerDHParams) {
    return new ServerKeyExchange2DH(params);
  }

  sizeOrThrow() {
    return this.params.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.params.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new ServerKeyExchange2DH(ServerDHParams.readOrThrow(cursor));
  }
}
