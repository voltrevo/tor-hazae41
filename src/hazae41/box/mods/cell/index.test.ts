import { test } from '../../../phobos/mod';
import { Cell } from './index';

function alloc(value: number) {
  console.log(`alloc(${value})`);
}

function free(value: number) {
  console.log(`free(${value})`);
}

class Pointer {
  constructor(readonly value: number) {
    alloc(value);
  }

  [Symbol.dispose]() {
    free(this.value);
  }

  plus(pointer: Pointer) {
    return new Pointer(this.value + pointer.value);
  }
}

function* getPointersOrThrow() {
  yield new Pointer(123);
  yield new Pointer(456);
  console.log('throwing');
  throw new Error();
  yield new Pointer(789);
}

test('slot', async ({ name }) => {
  try {
    console.log(`--- ${name} ---`);

    using result = new Cell(new Pointer(1));

    for (const pointer of getPointersOrThrow()) {
      using a = pointer;
      const b = result.get();

      result.set(a.plus(b));

      using _ = b;
    }

    console.log(result.get().value);
  } catch {
    console.error('fixme');
  }
});
