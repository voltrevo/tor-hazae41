import { test } from '../hazae41/phobos/mod';
import { assert } from '../utils/assert';
import { PACKAGE_VERSION } from './getStorageName';
import packageJson from '../../package.json' assert { type: 'json' };

test('getStorageName: constant matches package.json', async () => {
  assert(
    PACKAGE_VERSION === packageJson.version,
    `PACKAGE_VERSION (${PACKAGE_VERSION}) must match package.json version (${packageJson.version})`
  );
});
