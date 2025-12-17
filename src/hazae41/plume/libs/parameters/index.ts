/**
 * Like `Parameters<T>` but fixed
 */
export type WeakParameters<T extends (...args: any) => any> = (T extends (
  ...args: infer P
) => any
  ? [P]
  : never)[0];
