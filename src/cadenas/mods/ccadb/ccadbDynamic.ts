import { X509 } from '@hazae41/x509';
import { Writable } from '@hazae41/binary';
import { ccadbCertHashes } from './ccadbHashes.js';

export namespace CCadbDynamic {
  type CertificateSource = 'curl' | 'ccadb' | 'certifi';

  const sourceUrls: Record<CertificateSource, string> = {
    curl: 'https://curl.se/ca/cacert.pem',
    ccadb:
      'https://ccadb.my.salesforce-sites.com/mozilla/IncludedRootsPEMTxt?TrustBitsInclude=Websites',
    certifi:
      'https://raw.githubusercontent.com/certifi/python-certifi/master/certifi/cacert.pem',
  };

  const whitelistSet = new Set(ccadbCertHashes);

  export interface FetchResult {
    matched: string[];
    unrecognized: string[];
    source: CertificateSource;
    notFound: number; // Count of whitelisted certs not found in this source
  }

  /**
   * Fetch certificates with fallback chain:
   * 1. Try curl
   * 2. Fall back to ccadb
   * 3. Fall back to certifi
   *
   * Only includes certificates whose SPKI hash matches the whitelist.
   * Throws if no source succeeds.
   */
  export async function getDynamicBase64(): Promise<readonly string[]> {
    const sources: CertificateSource[] = ['curl', 'ccadb', 'certifi'];

    for (const source of sources) {
      try {
        const result = await fetchAndValidateCerts(source);
        if (result.matched.length > 0) {
          console.debug(
            `Successfully fetched ${result.matched.length} certs from ${source}`
          );
          return result.matched;
        }
      } catch (error) {
        console.debug(`Failed to fetch from ${source}:`, error);
      }
    }

    throw new Error(
      'All certificate sources failed or returned no whitelisted certificates'
    );
  }

  /**
   * Fetch and validate certificates from a specific source.
   * Returns both matched and unrecognized certificates for analysis.
   */
  export async function fetchAndValidateCerts(
    source: CertificateSource
  ): Promise<FetchResult> {
    const url = sourceUrls[source];
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch certificates: ${response.status} ${response.statusText}`
      );
    }

    const text = await response.text();
    const matched: string[] = [];
    const unrecognized: string[] = [];

    // Extract all PEM certificate blocks
    const certRegex =
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
    const pemMatches = text.match(certRegex);

    if (!pemMatches) {
      throw new Error('No certificates found in response');
    }

    // Convert PEM to base64 and validate against whitelist
    for (const pemCert of pemMatches) {
      const base64 = pemToBase64(pemCert);
      const isMatched = await validateCertHash(base64);

      if (isMatched) {
        matched.push(base64);
      } else {
        unrecognized.push(base64);
      }
    }

    // Count how many whitelisted certs were not found in this source
    let notFound = 0;
    notFound = whitelistSet.size - matched.length;

    return {
      matched: matched.sort(),
      unrecognized,
      source,
      notFound,
    };
  }

  function pemToBase64(pem: string): string {
    return pem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');
  }

  async function validateCertHash(base64: string): Promise<boolean> {
    try {
      const derBytes = Buffer.from(base64, 'base64');
      const x509 = X509.readAndResolveFromBytesOrThrow(
        X509.Certificate,
        derBytes
      );

      // Extract SPKI hash
      const spki = Writable.writeToBytesOrThrow(
        x509.tbsCertificate.subjectPublicKeyInfo.toDER()
      );
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));
      const hashBase16 = Buffer.from(hash).toString('hex');

      return whitelistSet.has(hashBase16);
    } catch {
      return false;
    }
  }
}
