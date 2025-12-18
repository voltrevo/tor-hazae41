import { Handshake } from '../handshake.js';
import { DigitallySigned } from '../../../signatures/digitally_signed.js';
import { ServerECDHParams } from './server_ecdh_params.js';
import { Bytes } from '../../../../../../bytes/index.js';
import { Cursor } from '../../../../../../cursor/mod.js';

export class ServerKeyExchange2ECDHSigned {
  static readonly type = Handshake.types.server_key_exchange;

  constructor(
    readonly params: ServerECDHParams,
    readonly signed_params: DigitallySigned
  ) {}

  sizeOrThrow() {
    return this.params.sizeOrThrow() + this.signed_params.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.params.writeOrThrow(cursor);
    this.signed_params.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const params = ServerECDHParams.readOrThrow(cursor);
    const signed_params = DigitallySigned.readOrThrow(cursor);

    return new ServerKeyExchange2ECDHSigned(params, signed_params);
  }
}

export class ServerKeyExchange2ECDHPreSigned {
  constructor(
    readonly client_random: Bytes<32>,
    readonly server_random: Bytes<32>,
    readonly params: ServerECDHParams
  ) {}

  sizeOrThrow() {
    return (
      this.client_random.length +
      this.server_random.length +
      this.params.sizeOrThrow()
    );
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.client_random);
    cursor.writeOrThrow(this.server_random);
    this.params.writeOrThrow(cursor);
  }
}
