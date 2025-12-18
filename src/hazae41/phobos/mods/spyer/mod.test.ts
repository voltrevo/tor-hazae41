import { test, expect, describe, vi } from 'vitest';

describe('spyer', () => {
  test('a simple boolean-not function', () => {
    const impl = (param: boolean) => !param;
    const f = vi.fn(impl);

    const result = f(true);
    expect(result).toBe(false);

    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(true);
  });
});
