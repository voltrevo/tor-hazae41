import '../../../symbol-dispose-polyfill/mod';

import { test, expect } from 'vitest';
import { Borrow, Borrowable } from '../borrow';
import { Box } from '.';

class Resource implements Disposable {
  disposed = false;

  [Symbol.dispose]() {
    this.disposed = true;
  }
}

class A<T extends Disposable> {
  constructor(readonly value: Box<T>) {}

  [Symbol.dispose]() {
    this.value[Symbol.dispose]();
  }

  toB() {
    return new B(this.value.moveOrThrow());
  }
}

class B<T extends Disposable> {
  constructor(readonly value: Box<T>) {}

  [Symbol.dispose]() {
    this.value[Symbol.dispose]();
  }

  toA() {
    return new A(this.value.moveOrThrow());
  }
}

test('holder', async () => {
  const resource = new Resource();
  const box = Box.wrap(resource);

  {
    using a = new A(box);
    using _b = a.toB();
  }

  expect(resource.disposed).toBe(true);
});

test('dummy', async () => {
  const resource = new Resource();

  /**
   * This block will keep ownership of the box
   */
  {
    using _box = Box.wrap(resource);

    expect(!resource.disposed).toBe(true);
  }

  expect(resource.disposed).toBe(true);
});

test('borrow', async () => {
  const resource = new Resource();

  async function borrow(parent: Borrowable<Resource>) {
    using borrow = Borrow.from(parent.borrowOrThrow());

    expect(borrow.get() === resource).toBe(true);

    expect(borrow.borrowed === false).toBe(true);
    expect(parent.borrowed === true).toBe(true);

    await borrow2(borrow);

    expect(borrow.borrowed === false).toBe(true);
    expect(parent.borrowed === true).toBe(true);
  }

  async function borrow2(parent: Borrowable<Resource>) {
    using borrow = Borrow.from(parent.borrowOrThrow());

    expect(borrow.get() === resource).toBe(true);

    expect(borrow.borrowed === false).toBe(true);
    expect(parent.borrowed === true).toBe(true);
  }

  {
    using box = Box.wrap(resource);

    await borrow(box);

    expect(box.borrowed === false).toBe(true);
  }

  expect(resource.disposed).toBe(true);
});
