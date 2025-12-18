import {
  BitString,
  DERCursor,
  DERTriplet,
  Integer,
  Sequence,
  Type,
} from '../../../../asn1/index';
import { AlgorithmIdentifier } from '../algorithm_identifier/algorithm_identifier';
import { Name } from '../name/name';
import { SubjectPublicKeyInfo } from '../subject_public_key_info/subject_public_key_info';
import { TBSCertificateVersion } from './tbs_certificate_version';
import { Validity } from '../validity/validity';
import { Extensions } from '../extensions/extensions';
import { Nullable } from '../../../../common/Nullable';

export class TBSCertificate {
  constructor(
    readonly version: Nullable<TBSCertificateVersion>,
    readonly serialNumber: Integer,
    readonly signature: AlgorithmIdentifier,
    readonly issuer: Name,
    readonly validity: Validity,
    readonly subject: Name,
    readonly subjectPublicKeyInfo: SubjectPublicKeyInfo,
    readonly issuerUniqueID: Nullable<BitString>,
    readonly subjectUniqueID: Nullable<BitString>,
    readonly extensions?: Nullable<Extensions>
  ) {}

  toDER(): DERTriplet {
    return Sequence.create(undefined, [
      this.version?.toDER(),
      this.serialNumber,
      this.signature.toDER(),
      this.issuer.toDER(),
      this.validity.toDER(),
      this.subject.toDER(),
      this.subjectPublicKeyInfo.toDER(),
      this.issuerUniqueID,
      this.subjectUniqueID,
      this.extensions?.toDER(),
    ] as const).toDER();
  }

  static resolveOrThrow(parent: DERCursor) {
    const cursor = parent.subAsOrThrow(Sequence.DER);
    const version = TBSCertificateVersion.resolveOrThrow(cursor);
    const serialNumber = cursor.readAsOrThrow(Integer.DER);
    const signature = AlgorithmIdentifier.resolveOrThrow(cursor);
    const issuer = Name.resolveOrThrow(cursor);
    const validity = Validity.resolveOrThrow(cursor);
    const subject = Name.resolveOrThrow(cursor);
    const subjectPublicKeyInfo = SubjectPublicKeyInfo.resolveOrThrow(cursor);

    const issuerUniqueID = cursor.readAsType(
      Type.DER.context(false, 1),
      BitString.DER
    );

    if (
      issuerUniqueID != null &&
      version?.value?.value !== TBSCertificateVersion.values.v2 &&
      version?.value?.value !== TBSCertificateVersion.values.v3
    )
      throw new Error(
        'Issuer unique ID must not be present unless version is 2 or 3'
      );

    const subjectUniqueID = cursor.readAsType(
      Type.DER.context(false, 2),
      BitString.DER
    );

    if (
      subjectUniqueID != null &&
      version?.value?.value !== TBSCertificateVersion.values.v2 &&
      version?.value?.value !== TBSCertificateVersion.values.v3
    )
      throw new Error(
        'Subject unique ID must not be present unless version is 2 or 3'
      );

    const extensions = Extensions.resolveOrThrow(cursor);

    if (
      extensions != null &&
      version?.value?.value !== TBSCertificateVersion.values.v3
    )
      throw new Error('Extensions must not be present unless version is 3');

    return new TBSCertificate(
      version,
      serialNumber,
      signature,
      issuer,
      validity,
      subject,
      subjectPublicKeyInfo,
      issuerUniqueID,
      subjectUniqueID,
      extensions
    );
  }
}
