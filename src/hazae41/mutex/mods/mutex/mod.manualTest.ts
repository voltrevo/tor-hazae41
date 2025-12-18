import { assert, rejects, test, throws } from '../../../phobos/mod';
import { Mutex, Semaphore } from './mod';

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
      assert(
        throws(() => mutex.getOrThrow()),
        `lock should err`
      );
    })()
  );

  await Promise.all(promises);

  assert(mutex.locked === false, `should be unlocked`);

  await mutex.runOrWait(order => {
    assert(
      JSON.stringify(order) ===
        JSON.stringify([
          'first start',
          'first end',
          'second start',
          'second end',
          'third start',
          'third end',
        ]),
      `unexpected order`
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
      assert(
        await rejects(() => mutex.runOrThrow(async () => {})),
        `tryLock should err`
      );
    })()
  );

  await Promise.all(promises);

  assert(mutex.locked === false, `should be unlocked`);

  await mutex.runOrWait(order => {
    assert(
      JSON.stringify(order) ===
        JSON.stringify([
          'first start',
          'first end',
          'second start',
          'second end',
          'third start',
          'third end',
        ]),
      `unexpected order`
    );
  });
});

test('semaphore', async () => {
  const promises = new Array<Promise<void>>();

  const semaphore = new Semaphore(undefined, 3);

  const tick = async () => {
    for (let i = 0; i < 100; i++) {
      console.log('tick');
      await new Promise(ok => setTimeout(ok, 100));
    }
  };

  const lock = (i: number) =>
    semaphore.runOrWait(async () => {
      console.log('start', i);
      await new Promise(ok => setTimeout(ok, 1000));
      console.log('end', i);
    });

  const wait = async () => {
    console.log('wait');
    await semaphore.runOrWait(() => {});
    console.log('done');
  };

  const acquire = async () => {
    using _ = await semaphore.lockOrWait();
    console.log('acquire');
    await new Promise(ok => setTimeout(ok, 1000));
    console.log('release');
  };

  promises.push(tick());
  promises.push(lock(1));
  promises.push(lock(2));
  promises.push(lock(3));
  promises.push(acquire());
  promises.push(lock(4));
  promises.push(lock(5));
  promises.push(wait());
  promises.push(lock(6));
  promises.push(lock(7));
  promises.push(lock(8));
  promises.push(lock(9));
  promises.push(lock(10));

  await Promise.all(promises);
});
