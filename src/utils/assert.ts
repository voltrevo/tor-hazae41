export function assert(cond: unknown): asserts cond {
  if (!cond) {
    throw new Error('Assertion failed');
  }
}
