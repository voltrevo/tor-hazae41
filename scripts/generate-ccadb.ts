#!/usr/bin/env npx tsx
/**
 * Generate ccadbStatic.ts from various CA certificate sources
 *
 * Usage: npx tsx scripts/generate-ccadb.ts [--source SOURCE]
 *
 * Available sources:
 *   - mozilla (default): Mozilla CCADB via certifi package
 *   - curl: curl's CA bundle (updated daily)
 *   - ccadb: CCADB CSV export (includes metadata)
 *   - letsencrypt: Let's Encrypt root certificates
 *
 * This script fetches certificate data and generates a TypeScript file with
 * base64-encoded certificates. It also runs eslint --fix on the generated file.
 */

import { PEM, X509 } from '@hazae41/x509';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface CertRow {
  PEM: string;
}

type CertificateSource = 'mozilla' | 'curl' | 'ccadb' | 'letsencrypt';

function getSourceFromArgs(): CertificateSource {
  const sourceArg = process.argv.find(arg => arg.startsWith('--source='));
  if (sourceArg) {
    const source = sourceArg.split('=')[1] as CertificateSource;
    const validSources: CertificateSource[] = [
      'mozilla',
      'curl',
      'ccadb',
      'letsencrypt',
    ];
    if (validSources.includes(source)) {
      return source;
    }
    console.error(
      `❌ Invalid source: ${source}. Valid options: ${validSources.join(', ')}`
    );
    process.exit(1);
  }
  return 'mozilla';
}

async function fetchCertificatesFromMozilla(): Promise<CertRow[]> {
  // Fetch from certifi (Python's Mozilla CA bundle)
  // This is the most reliable and regularly updated source
  const url =
    'https://raw.githubusercontent.com/certifi/python-certifi/master/certifi/cacert.pem';
  console.log('Fetching certificates from Mozilla CCADB (via certifi)...');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch certificates: ${response.status} ${response.statusText}`
    );
  }

  const pem = await response.text();
  const certRows: CertRow[] = [];

  // Extract certificates from the PEM bundle
  // Match complete certificate blocks (from BEGIN to END)
  const certRegex =
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  const matches = pem.match(certRegex);

  if (matches) {
    for (const cert of matches) {
      certRows.push({ PEM: cert.trim() });
    }
  }

  return certRows;
}

async function fetchCertificatesFromCurl(): Promise<CertRow[]> {
  // Fetch from curl's CA bundle (updated daily)
  const url = 'https://curl.se/ca/cacert.pem';
  console.log('Fetching certificates from curl.se (daily updates)...');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch certificates: ${response.status} ${response.statusText}`
    );
  }

  const pem = await response.text();
  const certRows: CertRow[] = [];

  // Extract certificates from the PEM bundle
  const certRegex =
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  const matches = pem.match(certRegex);

  if (matches) {
    for (const cert of matches) {
      certRows.push({ PEM: cert.trim() });
    }
  }

  return certRows;
}

async function fetchCertificatesFromCCADB(): Promise<CertRow[]> {
  // Fetch from CCADB CSV export
  // The CCADB provides detailed metadata for all major trust stores
  const url = 'https://www.ccadb.org/export';
  console.log('Fetching certificates from CCADB (with metadata)...');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch from CCADB: ${response.status} ${response.statusText}`
    );
  }

  const csv = await response.text();
  const lines = csv.split('\n');
  const certRows: CertRow[] = [];

  // CSV format: header line, then data rows
  // Find the PEM column (typically after many metadata columns)
  if (lines.length < 2) {
    throw new Error('CCADB CSV export is empty or invalid');
  }

  const headers = lines[0].split(',');
  const pemIndex = headers.findIndex(h => h.includes('PEM'));

  if (pemIndex === -1) {
    throw new Error('Could not find PEM column in CCADB CSV');
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV with quoted fields
    const values = line
      .split(',')
      .map(v => v.trim().replace(/^"/, '').replace(/"$/, ''));
    if (values[pemIndex]) {
      const pem = values[pemIndex].replace(/\\n/g, '\n').trim();
      if (
        pem.startsWith('-----BEGIN CERTIFICATE-----') &&
        pem.includes('-----END CERTIFICATE-----')
      ) {
        certRows.push({ PEM: pem });
      }
    }
  }

  return certRows;
}

async function fetchCertificatesFromLetsEncrypt(): Promise<CertRow[]> {
  // Let's Encrypt maintains its own roots
  // Fetch directly from their certificate page
  const urls = [
    'https://letsencrypt.org/certs/isrgrootx1.der',
    'https://letsencrypt.org/certs/isrgrootx2.der',
    'https://letsencrypt.org/certs/isrg-root-x2.pem',
  ];

  console.log("Fetching Let's Encrypt root certificates...");

  const certRows: CertRow[] = [];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const buffer = await response.arrayBuffer();

      // If it's DER format, convert to PEM
      if (url.endsWith('.der')) {
        const base64 = Buffer.from(buffer).toString('base64');
        const pem =
          '-----BEGIN CERTIFICATE-----\n' +
          base64.match(/.{1,64}/g)!.join('\n') +
          '\n-----END CERTIFICATE-----';
        certRows.push({ PEM: pem });
      } else {
        // Already PEM format
        const pem = Buffer.from(buffer).toString('utf8');
        const certRegex =
          /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
        const matches = pem.match(certRegex);
        if (matches) {
          for (const cert of matches) {
            certRows.push({ PEM: cert.trim() });
          }
        }
      }
    } catch {
      console.warn(`⚠️  Failed to fetch ${url}`);
    }
  }

  return certRows;
}

async function fetchCertificates(
  source: CertificateSource
): Promise<CertRow[]> {
  switch (source) {
    case 'mozilla':
      return fetchCertificatesFromMozilla();
    case 'curl':
      return fetchCertificatesFromCurl();
    case 'ccadb':
      return fetchCertificatesFromCCADB();
    case 'letsencrypt':
      return fetchCertificatesFromLetsEncrypt();
    default: {
      const exhaustive: never = source;
      throw new Error(`Unknown source: ${exhaustive}`);
    }
  }
}

async function generateCCADB() {
  const source = getSourceFromArgs();
  console.log(`Using source: ${source}\n`);

  const certRows = await fetchCertificates(source);

  const base64Certs: string[] = [];
  const seenSubjects = new Set<string>();
  let skipped = 0;

  for (const cert of certRows) {
    try {
      const pem = PEM.decodeOrThrow(cert.PEM);
      const x509 = X509.readAndResolveFromBytesOrThrow(X509.Certificate, pem);

      const x501 = x509.tbsCertificate.subject.toX501OrThrow();

      // Check for duplicates
      if (seenSubjects.has(x501)) {
        skipped++;
        continue;
      }
      seenSubjects.add(x501);

      // Convert PEM to base64
      const certBase16 = Buffer.from(pem).toString('hex');
      const certBase64 = Buffer.from(Buffer.from(certBase16, 'hex')).toString(
        'base64'
      );

      base64Certs.push(certBase64);
    } catch {
      skipped++;
    }
  }

  // Generate ccadbStatic.ts with base64 certificates
  const staticOutputPath = path.join(
    process.cwd(),
    'src/cadenas/mods/ccadb/ccadbStatic.ts'
  );
  const staticOutput =
    `// Auto-generated by scripts/generate-ccadb.ts --source=${source}\n` +
    '// Base64-encoded X.509 DER certificates\n' +
    '\n' +
    'export const ccadbStaticBase64: readonly string[] = ' +
    JSON.stringify(base64Certs) +
    ';\n';
  await fs.writeFile(staticOutputPath, staticOutput, 'utf8');

  // Run eslint --fix on generated file
  try {
    console.log(`Running eslint --fix on ${staticOutputPath}...`);
    execSync(`eslint --fix "${staticOutputPath}"`, { stdio: 'inherit' });
  } catch (error) {
    console.warn(`⚠️  eslint --fix failed:`, error);
  }

  const total = base64Certs.length;
  console.log(`\n✅ Generated ${staticOutputPath}`);
  console.log(`📊 ${total} certificates included, ${skipped} skipped`);
  console.log(`📌 Source: ${source}`);
}

generateCCADB().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
