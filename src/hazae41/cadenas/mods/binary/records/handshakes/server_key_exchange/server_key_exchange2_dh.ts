import { Cursor } from '../../../../../../cursor/mod.js';
import { Handshake } from '../handshake.js';
import { ServerDHParams } from './server_dh_params.js';

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
