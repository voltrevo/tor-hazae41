export interface Secrets {
  master_secret: Uint8Array,
  client_write_MAC_key: Uint8Array,
  server_write_MAC_key: Uint8Array,
  client_write_key: Uint8Array,
  server_write_key: Uint8Array,
  client_write_IV: Uint8Array,
  server_write_IV: Uint8Array
}