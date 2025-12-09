export function never(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}
