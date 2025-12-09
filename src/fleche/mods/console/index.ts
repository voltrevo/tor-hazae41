export namespace Console {
  export const debugging = false;

  export function debug(...params: unknown[]) {
    if (!debugging) return;
    console.debug(...params);
  }
}
