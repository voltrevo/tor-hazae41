/**
 * Like `Parameters<T>` but fixed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WeakParameters<T extends (...args: any) => any> = (T extends (
  ...args: infer P
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any
  ? [P]
  : never)[0];
