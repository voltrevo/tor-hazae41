import { test, expect } from 'vitest';
import { Validity } from './validity';

test('Validity generation', async () => {
  const inOneDay = Validity.generate(1);

  expect(
    inOneDay.notAfter.value.getUTCDate() ===
      inOneDay.notBefore.value.getUTCDate() + 1
  ).toBe(true);

  const inOneYear = Validity.generate(365);

  expect(
    inOneYear.notAfter.value.getUTCFullYear() ===
      inOneYear.notBefore.value.getUTCFullYear() + 1
  ).toBe(true);
});
