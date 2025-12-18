import '../../../symbol-dispose-polyfill/mod';

import { assert, test } from '../../../phobos/mod';
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

  assert(resource.disposed);
});

test('dummy', async () => {
  const resource = new Resource();

  /**
   * This block will keep ownership of the box
   */
  {
    using _box = Box.wrap(resource);

    assert(!resource.disposed);
  }

  assert(resource.disposed);
});

test('borrow', async () => {
  const resource = new Resource();

  async function borrow(parent: Borrowable<Resource>) {
    using borrow = Borrow.from(parent.borrowOrThrow());

    assert(borrow.get() === resource);

    assert(borrow.borrowed === false);
    assert(parent.borrowed === true);

    await borrow2(borrow);

    assert(borrow.borrowed === false);
    assert(parent.borrowed === true);
  }

  async function borrow2(parent: Borrowable<Resource>) {
    using borrow = Borrow.from(parent.borrowOrThrow());

    assert(borrow.get() === resource);

    assert(borrow.borrowed === false);
    assert(parent.borrowed === true);
  }

  {
    using box = Box.wrap(resource);

    await borrow(box);

    assert(box.borrowed === false);
  }

  assert(resource.disposed);
});
