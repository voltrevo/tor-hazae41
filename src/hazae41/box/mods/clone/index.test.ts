import { test, expect } from 'vitest';
import { Clone } from '.';

class Resource implements Disposable {
  disposed = false;

  [Symbol.dispose]() {
    this.disposed = true;
  }
}

test('count', async () => {
  const resource = new Resource();

  {
    using count = Clone.wrap(resource);

    {
      using clone = count.clone();

      {
        using _ = clone.clone();
      }
    }

    expect(count.count === 1).toBe(true);

    {
      async function use(count: Clone<Resource>) {
        using _ = count.clone();

        await new Promise(resolve => setTimeout(resolve, 1000));

        return;
      }

      use(count);
    }
  }

  expect(!resource.disposed).toBe(true);

  await new Promise(resolve => setTimeout(resolve, 2000));

  expect(resource.disposed).toBe(true);
});
