import '../../symbol-dispose-polyfill/mod';

import { Future } from '../../future';
import { Some } from '../../option';
import { test, expect, describe } from 'vitest';
import { SuperEventTarget } from './target';
import { waitWithCloseAndErrorOrThrow } from './waiters';

describe('AsyncEventTarget', () => {
  test('main test', async () => {
    const target = new SuperEventTarget<{
      test: (order: 'first' | 'second') => number;
      error: (reason: unknown) => void;
      close: (reason: unknown) => void;
    }>();

    const stack = new Array<string>();

    target.on(
      'test',
      async order => {
        if (order !== 'first') return;

        stack.push(order);

        return new Some(123);
      },
      { passive: true }
    );

    target.on(
      'test',
      async order => {
        if (order !== 'second') return;

        stack.push(order);

        return new Some(456);
      },
      { passive: true }
    );

    const waitTest = new Promise<void>(resolve => {
      (async () => {
        const signal = AbortSignal.timeout(1000);

        await waitWithCloseAndErrorOrThrow(
          target,
          'test',
          (future: Future<string>, order) => {
            future.resolve(order);
          },
          signal
        );

        const signal2 = AbortSignal.timeout(1000);

        await waitWithCloseAndErrorOrThrow(
          target,
          'test',
          (future: Future<string>, order) => {
            future.resolve(order);
          },
          signal2
        );

        resolve();
      })();
    });

    await new Promise(ok => setTimeout(ok, 100));

    const first = await target.emit('test', 'first');
    expect(first.isSome()).toBe(true);

    await new Promise(ok => setTimeout(ok, 100));

    const second = await target.emit('test', 'second');
    expect(second.isSome()).toBe(true);

    stack.push('done');

    await waitTest;

    expect(stack.length === 3).toBe(true);
    expect(stack[0] === 'first').toBe(true);
    expect(stack[1] === 'second').toBe(true);
    expect(stack[2] === 'done').toBe(true);
  });
});
