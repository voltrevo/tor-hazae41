import '@hazae41/symbol-dispose-polyfill';

import { test } from '../../../phobos/mod';
import { AsyncDisposer, Disposer } from './dispose';

await test('sync', async ({ name }) => {
  console.log(name);

  function f(i: number) {
    const create = async () => {
      await new Promise(ok => setTimeout(ok, 1000 - 1 * 100));
      console.log(`created ${i}`);
    };

    const dispose = () => {
      console.log(`disposed ${i}`);
    };

    return new Disposer(create(), dispose);
  }

  using a = f(1);
  using b = f(2);
  using c = f(3);

  await Promise.all([a, b, c]);
});

await test('async', async ({ name }) => {
  console.log(name);

  function f(i: number) {
    const create = async () => {
      await new Promise(ok => setTimeout(ok, 1000 - 1 * 100));
      console.log(`created ${i}`);
    };

    const dispose = async () => {
      await new Promise(ok => setTimeout(ok, 1000 - 1 * 100));
      console.log(`disposed ${i}`);
    };

    return new AsyncDisposer(create(), dispose);
  }

  await using a = f(1);
  await using b = f(2);
  await using c = f(3);

  await Promise.all([a, b, c]);
});
