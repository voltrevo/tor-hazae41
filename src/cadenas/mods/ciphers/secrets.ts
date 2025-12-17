import { Bytes } from '../../../hazae41/bytes';

export interface Secrets {
  master_secret: Bytes;
  client_write_MAC_key: Bytes;
  server_write_MAC_key: Bytes;
  client_write_key: Bytes;
  server_write_key: Bytes;
  client_write_IV: Bytes;
  server_write_IV: Bytes;
}
