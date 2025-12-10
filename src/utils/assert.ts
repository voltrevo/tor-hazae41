export function assert(cond: unknown, message?: string): asserts cond {
  if (!cond) {
    throw new Error('Assertion failed' + message ? `: ${message}` : '');
  }
}
