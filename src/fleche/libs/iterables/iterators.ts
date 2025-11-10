export namespace Iterators {

  export type Peeked<T, TReturn = any> = {
    current: T,
    next: IteratorResult<T, TReturn>
  }

  export type Peeker<T, TReturn = any, TNext = undefined> = Generator<Peeked<T, TReturn>, TReturn, TNext>

  export function* peek<T, TReturn = any, TNext = undefined>(iterator: Iterator<T, TReturn, TNext>): Peeker<T, TReturn, TNext> {
    let next = iterator.next()

    while (!next.done) {
      const current = next.value
      next = iterator.next()
      yield { current, next }
    }

    return next.value
  }

}