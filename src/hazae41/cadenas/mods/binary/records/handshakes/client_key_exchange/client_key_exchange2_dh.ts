import { ClientDiffieHellmanPublic } from './client_diffie_hellman_public.js';
import { Handshake } from '../handshake.js';
import { Bytes } from '../../../../../../bytes/index.js';
import { Cursor } from '../../../../../../cursor/index.js';

export class ClientKeyExchange2DH {
  readonly #class = ClientKeyExchange2DH;

  static readonly handshake_type = Handshake.types.client_key_exchange;

  constructor(readonly exchange_keys: ClientDiffieHellmanPublic) {}

  static new(exchange_keys: ClientDiffieHellmanPublic) {
    return new ClientKeyExchange2DH(exchange_keys);
  }

  static from(bytes: Bytes) {
    return new ClientKeyExchange2DH(ClientDiffieHellmanPublic.from(bytes));
  }

  get handshake_type() {
    return this.#class.handshake_type;
  }

  sizeOrThrow() {
    return this.exchange_keys.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.exchange_keys.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new ClientKeyExchange2DH(
      ClientDiffieHellmanPublic.readOrThrow(cursor)
    );
  }
}
