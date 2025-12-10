/**
 * Internal invariant assertion - use for checking assumptions about code logic
 * that should never be violated in correct code. These are cheap checks that
 * help document code assumptions and catch logic bugs during development.
 *
 * Unlike runtime assertions, invariant failures indicate a bug in the code itself,
 * not invalid external input.
 */
export function invariant(cond: unknown, message?: string): asserts cond {
  if (!cond) {
    throw new Error(message || 'Invariant violation');
  }
}
