import { assert, spy, test } from '@/mod.ts';

test('spyer', async ({ test }) => {
  await test('a simple boolean-not function', () => {
    const f = spy((param: boolean) => !param);

    const result = f.call(true);
    assert(result === false, `result should be false`);

    assert(f.calls.length === 1, `should have been called 1 time`);
    assert(f.calls[0].params[0] === true, `should have been called with true`);
    assert(f.calls[0].result === false, `should have resulted in false`);
  });
});
