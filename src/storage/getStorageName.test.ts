import { test, expect } from 'vitest';
import { PACKAGE_VERSION } from './getStorageName';
import packageJson from '../../package.json' assert { type: 'json' };

test('getStorageName: constant matches package.json', async () => {
  expect(PACKAGE_VERSION === packageJson.version).toBe(true);
});
