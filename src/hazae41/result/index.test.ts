import { test, expect } from 'vitest';
import { Err, Ok, Result } from './result';

test('try-catch', async () => {
  expect(() =>
    Result.unthrowSync(_t => {
      throw new Error();
    })
  ).toThrow();

  expect(() =>
    Result.unthrowSync<Result<void, Error>>(t => {
      new Err(new Error()).throw(t);

      return Ok.void();
    })
  ).not.toThrow();
});

function* okGenerator() {
  yield new Ok(1);
  yield new Ok(2);
  yield new Ok(3);
  yield new Ok(4);
}

function* errGenerator() {
  yield new Ok(1);
  yield new Ok(2);
  yield new Err(3);
  yield new Ok(4);
}

test('iterators', async () => {
  const ok = Result.all(okGenerator());
  const err = Result.all(errGenerator());

  expect(
    ok.isOkAndSync(
      inner => JSON.stringify(inner) === JSON.stringify([1, 2, 3, 4])
    )
  ).toBe(true);
  expect(err.isErrAndSync(inner => inner === 3)).toBe(true);
});
