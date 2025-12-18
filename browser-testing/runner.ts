// Browser test runner - loads vitest test files
// Tests are automatically discovered and run by vitest in browser mode

import { test, expect } from 'vitest';

// Import all test modules
// Note: In browser mode, vitest will automatically discover and run all test.ts files
// This runner file is loaded first to set up the browser environment if needed

interface WindowWithTests extends Window {
  __tests_completed?: boolean;
  __tests_failed?: boolean;
}

// Signal that tests have loaded
test('browser environment ready', () => {
  expect(typeof window).toBe('object');
  (window as WindowWithTests).__tests_completed = true;
});
