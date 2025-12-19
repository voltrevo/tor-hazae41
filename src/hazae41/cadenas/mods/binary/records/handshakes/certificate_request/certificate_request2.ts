import { ReadableList } from '../../../lists/readable.js';
import { List } from '../../../lists/writable.js';
import { Number16 } from '../../../numbers/number16.js';
import { Number8 } from '../../../numbers/number8.js';
import { Handshake } from '../handshake.js';
import { SignatureAndHashAlgorithm } from '../../../signatures/signature_and_hash_algorithm.js';
import { ReadableVector } from '../../../vectors/readable.js';
import { Vector } from '../../../vectors/writable.js';
import { Cursor } from '../../../../../../cursor/index.js';
import { Unknown } from '../../../../../../binary/mod.js';
import { SafeUnknown } from '../../../../../../binary/safe-unknown';

export class ClientCertificateType {
  static readonly types = {
    rsa_sign: 1,
    dss_sign: 2,
    rsa_fixed_dh: 3,
    dss_fixed_dh: 4,
    rsa_ephemeral_dh_RESERVED: 5,
    dss_ephemeral_dh_RESERVED: 6,
    fortezza_dms_RESERVED: 20,
  } as const;

  constructor(readonly type: number) {}

  static new(type: number) {
    return new ClientCertificateType(type);
  }

  sizeOrThrow() {
    return 1;
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.type);
  }

  static readOrThrow(cursor: Cursor) {
    return new ClientCertificateType(cursor.readUint8OrThrow());
  }
}

export class CertificateRequest2 {
  static readonly type = Handshake.types.certificate_request;

  constructor(
    readonly certificate_types: Vector<Number8, List<ClientCertificateType>>,
    readonly supported_signature_algorithms: Vector<
      Number16,
      List<SignatureAndHashAlgorithm>
    >,
    readonly certificate_authorities: Vector<Number16, Unknown>
  ) {}

  sizeOrThrow() {
    return (
      0 +
      this.certificate_types.sizeOrThrow() +
      this.supported_signature_algorithms.sizeOrThrow() +
      this.certificate_authorities.sizeOrThrow()
    );
  }

  writeOrThrow(cursor: Cursor) {
    this.certificate_types.writeOrThrow(cursor);
    this.supported_signature_algorithms.writeOrThrow(cursor);
    this.certificate_authorities.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    const certificate_types = ReadableVector(
      Number8,
      ReadableList(ClientCertificateType)
    ).readOrThrow(cursor);
    const supported_signature_algorithms = ReadableVector(
      Number16,
      ReadableList(SignatureAndHashAlgorithm)
    ).readOrThrow(cursor);
    const certificate_authorities = ReadableVector(
      Number16,
      SafeUnknown
    ).readOrThrow(cursor);

    return new CertificateRequest2(
      certificate_types,
      supported_signature_algorithms,
      certificate_authorities
    );
  }
}
