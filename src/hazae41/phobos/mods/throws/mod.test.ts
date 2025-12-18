import { test, expect, describe } from 'vitest';

function throwable() {
  throw new Error('lol');
}

function notThrowable() {}

describe('throws', () => {
  test('should throw', () => {
    expect(() => throwable()).toThrow();
  });

  test('should not throw', () => {
    expect(() => notThrowable()).not.toThrow();
  });
});

// deno-lint-ignore require-await
async function rejectable() {
  throw new Error('lol');
}

// deno-lint-ignore require-await
async function notRejectable() {}

describe('rejects', () => {
  test('should reject', async () => {
    await expect(rejectable()).rejects.toThrow();
  });

  test('should not reject', async () => {
    // This promise resolves successfully, so it should not reject
    await expect(notRejectable()).resolves.toBeUndefined();
  });
});
