import { Handshake } from '../../../../../mods/binary/records/handshakes/handshake.js';
import { ClientECDiffieHellmanPublic } from './client_ec_diffie_hellman_public.js';
import { Bytes } from '../../../../../../hazae41/bytes/index.js';
import { Cursor } from '../../../../../../hazae41/cursor/mod.js';

export class ClientKeyExchange2ECDH {
  readonly #class = ClientKeyExchange2ECDH;

  static readonly handshake_type = Handshake.types.client_key_exchange;

  constructor(readonly exchange_keys: ClientECDiffieHellmanPublic) {}

  static new(exchange_keys: ClientECDiffieHellmanPublic) {
    return new ClientKeyExchange2ECDH(exchange_keys);
  }

  static from(bytes: Bytes) {
    return new ClientKeyExchange2ECDH(ClientECDiffieHellmanPublic.from(bytes));
  }

  get handshake_type() {
    return this.#class.handshake_type;
  }

  sizeOrThrow() {
    return this.exchange_keys.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    return this.exchange_keys.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new ClientKeyExchange2ECDH(
      ClientECDiffieHellmanPublic.readOrThrow(cursor)
    );
  }
}
