import '../../../symbol-dispose-polyfill/mod';

import { Future } from '../../../future';
import { test } from 'vitest';
import { Auto } from '.';

class Resource implements Disposable {
  readonly future = new Future<void>();

  [Symbol.dispose]() {
    console.log('auto disposed');
    this.future.resolve();
  }
}

test('auto', async ({ task }) => {
  console.log(`--- ${task.name} ---`);

  const resource = new Resource();

  {
    const _auto = new Auto(resource);
  }

  await new Promise(ok => setTimeout(ok, 1_000));

  for (let i = 1; i < 10; i++, await new Promise(ok => setTimeout(ok, 1_000)))
    console.log(i);

  await resource.future.promise;
});
