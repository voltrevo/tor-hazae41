import '../../../symbol-dispose-polyfill/mod';

import { test } from 'vitest';
import { VirtualClock } from '../../../../clock/VirtualClock';
import { AsyncDisposer, Disposer } from './dispose';

test('sync', async () => {
  const clock = new VirtualClock({ automated: true });

  function f(_i: number) {
    const create = async () => {
      await new Promise<void>(ok =>
        clock.setTimeout(() => ok(), 1000 - 1 * 100)
      );
    };

    const dispose = () => {};

    return new Disposer(create(), dispose);
  }

  using a = f(1);
  using b = f(2);
  using c = f(3);

  await Promise.all([a, b, c]);
});

test('async', async () => {
  const clock = new VirtualClock({ automated: true });

  function f(_i: number) {
    const create = async () => {
      await new Promise<void>(ok =>
        clock.setTimeout(() => ok(), 1000 - 1 * 100)
      );
    };

    const dispose = async () => {
      await new Promise<void>(ok =>
        clock.setTimeout(() => ok(), 1000 - 1 * 100)
      );
    };

    return new AsyncDisposer(create(), dispose);
  }

  await using a = f(1);
  await using b = f(2);
  await using c = f(3);

  await Promise.all([a, b, c]);
});
