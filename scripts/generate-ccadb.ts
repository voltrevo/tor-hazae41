#!/usr/bin/env npx tsx
/**
 * Generate ccadb.ts from Mozilla CCADB
 *
 * This script fetches certificate data from the Mozilla certifi package (Python's
 * standard CA bundle which is based on Mozilla CCADB), validates and processes them,
 * then generates a TypeScript file with the trusted root certificates.
 * It also runs eslint --fix on the generated file.
 */

import { PEM, X509 } from '@hazae41/x509';
import { Writable } from '@hazae41/binary';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface CertRow {
  PEM: string;
}

interface TrustedCert {
  readonly hashBase16: string;
  readonly certBase16: string;
  readonly notAfter?: string;
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

async function generateCCADB() {
  const outputPath = path.join(
    process.cwd(),
    'src/cadenas/mods/ccadb/ccadb.ts'
  );

  const certRows = await fetchCertificatesFromMozilla();

  const trusteds: Record<string, TrustedCert> = {};
  let skipped = 0;

  for (const cert of certRows) {
    try {
      const pem = PEM.decodeOrThrow(cert.PEM);
      const x509 = X509.readAndResolveFromBytesOrThrow(X509.Certificate, pem);

      const x501 = x509.tbsCertificate.subject.toX501OrThrow();

      // Check for duplicates
      if (trusteds[x501]) {
        skipped++;
        continue;
      }

      // Extract public key hash
      const spki = Writable.writeToBytesOrThrow(
        x509.tbsCertificate.subjectPublicKeyInfo.toDER()
      );
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));

      const certBase16 = Buffer.from(pem).toString('hex');
      const hashBase16 = Buffer.from(hash).toString('hex');

      // Extract notAfter date from certificate
      const validity = x509.tbsCertificate.validity;
      const notAfter = validity.toJSON().notAfter;

      trusteds[x501] = {
        hashBase16,
        certBase16,
        ...(notAfter && { notAfter }),
      };
    } catch {
      skipped++;
    }
  }

  // Generate TypeScript code
  const output =
    'export namespace CCADB {\n' +
    '  export interface Trusted {\n' +
    '    readonly hashBase16: string;\n' +
    '    readonly certBase16: string;\n' +
    '    readonly notAfter?: string;\n' +
    '  }\n' +
    '\n' +
    '  export const trusteds: Record<string, Trusted> = ' +
    JSON.stringify(trusteds, null, 2) +
    ';\n' +
    '}\n';
  await fs.writeFile(outputPath, output, 'utf8');

  // Run eslint --fix on the generated file
  try {
    console.log(`Running eslint --fix on ${outputPath}...`);
    execSync(`eslint --fix "${outputPath}"`, { stdio: 'inherit' });
  } catch (error) {
    console.warn(`⚠️  eslint --fix failed:`, error);
  }

  const total = Object.keys(trusteds).length;
  console.log(`✅ Generated ${outputPath}`);
  console.log(`📊 ${total} certificates included, ${skipped} skipped`);
}

generateCCADB().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
