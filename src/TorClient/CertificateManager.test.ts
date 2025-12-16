import { test } from '@hazae41/phobos';
import { assert } from '../utils/assert';
import { CertificateManager } from './CertificateManager';
import { MemoryStorage } from '../storage';
import { Log } from '../Log';
import { Circuit } from '../echalote';
import { Echalote } from '../echalote';
import { App } from './App';
import { SystemClock } from '../clock';

// Mock circuit implementation
class MockCircuit {
  // Mock circuit for testing
}

// Mock certificate factory
function createMockCertificate(
  overrides: Partial<Echalote.Consensus.Certificate> = {}
): Echalote.Consensus.Certificate {
  const now = new Date();
  return {
    version: 3,
    fingerprint:
      overrides.fingerprint ||
      'test-fingerprint-' + Math.random().toString(36).substring(2, 11),
    published:
      overrides.published || new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
    expires:
      overrides.expires || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    identityKey: overrides.identityKey || 'test-identity-key',
    signingKey: overrides.signingKey || 'test-signing-key',
    crossCert: overrides.crossCert || 'test-cross-cert',
    preimage: overrides.preimage || 'test-preimage',
    signature: overrides.signature || 'test-signature',
    ...overrides,
  };
}

function createApp() {
  const app = new App();
  const clock = new SystemClock(); // FIXME: should use virtual clock
  app.set('Clock', clock);
  app.set('Log', new Log({ clock, rawLog: () => {} }));
  app.set('Storage', new MemoryStorage());

  return app;
}

test('CertificateManager: basic functionality', async () => {
  const app = createApp();
  const certificateManager = new CertificateManager({
    app,
    maxCached: 3,
  });
  const mockCircuit = new MockCircuit() as Circuit;

  try {
    const mockCertificate = createMockCertificate({
      fingerprint: 'test-fp-basic',
    });

    // Mock fetchOrThrow method
    const originalFetchOrThrow = Echalote.Consensus.Certificate.fetchOrThrow;
    let fetchCallCount = 0;
    Echalote.Consensus.Certificate.fetchOrThrow = async () => {
      fetchCallCount++;
      return mockCertificate;
    };

    const result = await certificateManager.getCertificate(
      mockCircuit,
      'test-fp-basic'
    );

    assert(
      result.fingerprint === 'test-fp-basic',
      'Should return correct certificate'
    );
    assert(fetchCallCount === 1, 'Should call fetchOrThrow once');

    // Verify certificate was cached
    const cachedData = await app.get('Storage').read('cert:test-fp-basic');
    assert(cachedData !== undefined, 'Certificate should be cached');

    // Restore original method
    Echalote.Consensus.Certificate.fetchOrThrow = originalFetchOrThrow;
  } finally {
    certificateManager.close();
    app.get('Storage').removeAll();
  }
});
