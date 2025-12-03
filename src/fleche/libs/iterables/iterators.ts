export namespace Iterators {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ExplicitAny = any;

  export type Peeked<T, TReturn = ExplicitAny> = {
    current: T;
    next: IteratorResult<T, TReturn>;
  };

  export type Peeker<T, TReturn = ExplicitAny, TNext = undefined> = Generator<
    Peeked<T, TReturn>,
    TReturn,
    TNext
  >;

  export function* peek<T, TReturn = ExplicitAny, TNext = undefined>(
    iterator: Iterator<T, TReturn, TNext>
  ): Peeker<T, TReturn, TNext> {
    let next = iterator.next();

    while (!next.done) {
      const current = next.value;
      next = iterator.next();
      yield { current, next };
    }

    return next.value;
  }
}
