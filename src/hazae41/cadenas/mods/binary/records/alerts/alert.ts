import { Cursor } from '../../../../../cursor/mod.js';
import { Record } from '../record.js';

export class Alert {
  readonly #class = Alert;

  static readonly record_type = Record.types.alert;

  static readonly levels = {
    warning: 1,
    fatal: 2,
  } as const;

  static readonly descriptions = {
    close_notify: 0,
    unexpected_message: 10,
    bad_record_mac: 20,
    record_overflow: 22,
    handshake_failure: 40,
    bad_certificate: 42,
    unsupported_certificate: 43,
    certificate_revoked: 44,
    certificate_expired: 45,
    certificate_unknown: 46,
    illegal_parameter: 47,
    unknown_ca: 48,
    access_denied: 49,
    decode_error: 50,
    decrypt_error: 51,
    protocol_version: 70,
    insufficient_security: 71,
    internal_error: 80,
    inappropriate_fallback: 86,
    user_canceled: 90,
    missing_extension: 109,
    unsupported_extension: 110,
    unrecognized_name: 112,
    bad_certificate_status_response: 113,
    unknown_psk_identity: 115,
    certificate_required: 116,
    no_application_protocol: 120,
  } as const;

  constructor(
    readonly level: number,
    readonly description: number
  ) {}

  get record_type() {
    return this.#class.record_type;
  }

  sizeOrThrow() {
    return 2; // 1 + 1
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.level);
    cursor.writeUint8OrThrow(this.description);
  }

  static readOrThrow(cursor: Cursor) {
    const level = cursor.readUint8OrThrow();
    const description = cursor.readUint8OrThrow();

    return new Alert(level, description);
  }
}
