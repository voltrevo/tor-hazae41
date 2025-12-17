import '@hazae41/symbol-dispose-polyfill';

import { Future } from '../../../future/index.ts';
import { test } from '../../../phobos/mod.ts';
import { Auto } from './index';

class Resource implements Disposable {
  readonly future = new Future<void>();

  [Symbol.dispose]() {
    console.log('auto disposed');
    this.future.resolve();
  }
}

await test('auto', async ({ test, message }) => {
  console.log(`--- ${message} ---`);

  const resource = new Resource();

  {
    const auto = new Auto(resource);
  }

  await new Promise(ok => setTimeout(ok, 1_000));

  for (let i = 1; i < 10; i++, await new Promise(ok => setTimeout(ok, 1_000)))
    console.log(i);

  await resource.future.promise;
});
