// Package version - must match version in package.json
export const PACKAGE_VERSION = '0.2.6';

export function getStorageName(): string {
  return `tor-js-${PACKAGE_VERSION}-cache`;
}
