import { invert } from '../../../common/invert';

export namespace OIDs {
  export type Key = keyof typeof keys;
  export type Value = keyof typeof values;

  export const keys = {
    commonName: '2.5.4.3',
    serialNumber: '2.5.4.5',
    countryName: '2.5.4.6',
    localityName: '2.5.4.7',
    stateOrProvinceName: '2.5.4.8',
    streetAddress: '2.5.4.9',
    organizationName: '2.5.4.10',
    organizationalUnitName: '2.5.4.11',
    emailAddress: '1.2.840.113549.1.9.1',
    sha256WithRSAEncryption: '1.2.840.113549.1.1.11',
    rsaEncryption: '1.2.840.113549.1.1.1',
    domainComponent: '0.9.2342.19200300.100.1.25',
    userId: '0.9.2342.19200300.100.1.1',
    subjectAltName: '2.5.29.17',
  } as const;

  export const values = invert(keys);
}
