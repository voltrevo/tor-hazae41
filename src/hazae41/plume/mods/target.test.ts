import '../../symbol-dispose-polyfill/mod';

import { Future } from '../../future';
import { Some } from '../../option';
import { assert, test } from '../../phobos/mod';
import { SuperEventTarget } from './target';
import { waitWithCloseAndErrorOrThrow } from './waiters';

test('AsyncEventTarget', async () => {
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

  const innerTestPromise = test('wait', async () => {
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
  });

  await new Promise(ok => setTimeout(ok, 100));

  const first = await target.emit('test', 'first');
  assert(first.isSome(), 'Event has not been handled');

  await new Promise(ok => setTimeout(ok, 100));

  const second = await target.emit('test', 'second');
  assert(second.isSome(), 'Event has not been handled');

  stack.push('done');

  await innerTestPromise;

  assert(stack.length === 3);
  assert(stack[0] === 'first');
  assert(stack[1] === 'second');
  assert(stack[2] === 'done');
});
