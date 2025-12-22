import { expect, test } from 'vitest';
import { Mutex } from './index';

test('run', async () => {
  const promises = new Array<Promise<void>>();

  const mutex = new Mutex(new Array<string>());

  promises.push(
    (async () => {
      await mutex.runOrWait(async order => {
        order.push('second start');
        await new Promise(ok => setTimeout(ok, 100));
        order.push('second end');
      });
    })()
  );

  promises.push(
    (async () => {
      await mutex.runOrWait(async order => {
        order.push('second start');
        await new Promise(ok => setTimeout(ok, 100));
        order.push('second end');
      });
    })()
  );

  promises.push(
    (async () => {
      await mutex.runOrWait(async order => {
        order.push('third start');
        await new Promise(ok => setTimeout(ok, 100));
        order.push('third end');
      });
    })()
  );

  promises.push(
    (async () => {
      expect(() => mutex.getOrThrow()).toThrow();
    })()
  );

  await Promise.all(promises);

  expect(mutex.locked).toBe(false);

  await mutex.runOrWait(order => {
    expect(JSON.stringify(order)).toBe(
      JSON.stringify([
        'first start',
        'first end',
        'second start',
        'second end',
        'third start',
        'third end',
      ])
    );
  });
});

test('acquire', async () => {
  const promises = new Array<Promise<void>>();

  const mutex = new Mutex(new Array<string>());

  promises.push(
    (async () => {
      using clone = await mutex.lockOrWait();
      clone.value.push('first start');
      await new Promise(ok => setTimeout(ok, 100));
      clone.value.push('first end');
    })()
  );

  promises.push(
    (async () => {
      await mutex.runOrWait(async order => {
        order.push('second start');
        await new Promise(ok => setTimeout(ok, 100));
        order.push('second end');
      });
    })()
  );

  promises.push(
    (async () => {
      using clone = await mutex.lockOrWait();
      clone.value.push('third start');
      await new Promise(ok => setTimeout(ok, 100));
      clone.value.push('third end');
    })()
  );

  promises.push(
    (async () => {
      await expect(mutex.runOrThrow(async () => {})).rejects.toThrow();
    })()
  );

  await Promise.all(promises);

  expect(mutex.locked).toBe(false);

  await mutex.runOrWait(order => {
    expect(JSON.stringify(order)).toBe(
      JSON.stringify([
        'first start',
        'first end',
        'second start',
        'second end',
        'third start',
        'third end',
      ])
    );
  });
});
