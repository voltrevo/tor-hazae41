export type CertificateSource = 'curl' | 'ccadb' | 'certifi';

const sourceUrls: Record<CertificateSource, string> = {
  curl: 'https://curl.se/ca/cacert.pem',
  ccadb:
    'https://ccadb.my.salesforce-sites.com/mozilla/IncludedRootsPEMTxt?TrustBitsInclude=Websites',
  certifi:
    'https://raw.githubusercontent.com/certifi/python-certifi/master/certifi/cacert.pem',
};

/**
 * Fetch certificates from a specific source.
 * Returns base64-encoded certificate strings without validation.
 */
export async function getRawCerts(
  source: CertificateSource
): Promise<string[]> {
  const url = sourceUrls[source];
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch certificates: ${response.status} ${response.statusText}`
    );
  }

  const text = await response.text();

  // Extract all PEM certificate blocks
  const certRegex =
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  const pemMatches = text.match(certRegex);

  if (!pemMatches) {
    throw new Error('No certificates found in response');
  }

  // Convert PEM to base64
  return pemMatches.map(pemToBase64);
}

function pemToBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s/g, '');
}

/**
 * Fetch certificates with fallback chain:
 * 1. Try curl
 * 2. Fall back to ccadb
 * 3. Fall back to certifi
 *
 * Returns a list of base64-encoded certificate strings.
 * Throws if no source succeeds.
 */
export async function fetchCerts(
  source?: CertificateSource
): Promise<string[]> {
  const sources: CertificateSource[] = source
    ? [source]
    : ['curl', 'ccadb', 'certifi'];

  for (const source of sources) {
    try {
      const certs = await getRawCerts(source);
      if (certs.length > 0) {
        console.debug(
          `Successfully fetched ${certs.length} certs from ${source}`
        );
        return certs;
      }
    } catch (error) {
      console.debug(`Failed to fetch from ${source}:`, error);
    }
  }

  throw new Error('All certificate sources failed');
}

export type FetchCerts = typeof fetchCerts;
