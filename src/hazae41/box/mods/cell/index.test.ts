import { assert } from '../../../../utils/assert';
import { test } from '../../../phobos/mod';
import { Cell } from '.';

function alloc(_value: number) {}

function free(_value: number) {}

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
  throw new Error('msg');
  yield new Pointer(789);
}

test('slot', async () => {
  using result = new Cell(new Pointer(1));
  let threw = false;

  try {
    for (const pointer of getPointersOrThrow()) {
      using a = pointer;
      const b = result.get();

      result.set(a.plus(b));

      using _ = b;
    }
  } catch (e) {
    assert((e as Error).message === 'msg');
    threw = true;
  }

  assert(threw);
  assert(result.get().value === 1 + 123 + 456);
});
