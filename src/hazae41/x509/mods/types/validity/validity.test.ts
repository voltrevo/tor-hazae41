import { assert, test } from '../../../../phobos/mod';
import { Validity } from './validity';


test('Validity generation', async () => {
  const inOneDay = Validity.generate(1);

  assert(
    inOneDay.notAfter.value.getUTCDate() ===
      inOneDay.notBefore.value.getUTCDate() + 1
  );

  const inOneYear = Validity.generate(365);

  assert(
    inOneYear.notAfter.value.getUTCFullYear() ===
      inOneYear.notBefore.value.getUTCFullYear() + 1
  );
});
