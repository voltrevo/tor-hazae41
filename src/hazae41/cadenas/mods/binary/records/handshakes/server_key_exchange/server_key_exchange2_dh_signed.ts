import { Cursor } from '../../../../../../cursor/index.js';
import { Handshake } from '../handshake.js';
import { ServerDHParams } from './server_dh_params.js';
import { DigitallySigned } from '../../../signatures/digitally_signed.js';

export class ServerKeyExchange2DHSigned {
  static readonly type = Handshake.types.server_key_exchange;

  constructor(
    readonly params: ServerDHParams,
    readonly signed_params: DigitallySigned
  ) {}

  sizeOrThrow() {
    return 0 + this.params.sizeOrThrow() + this.signed_params.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.params.writeOrThrow(cursor);
    this.signed_params.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const params = ServerDHParams.readOrThrow(cursor);
    const signed_params = DigitallySigned.readOrThrow(cursor);

    return new ServerKeyExchange2DHSigned(params, signed_params);
  }
}
