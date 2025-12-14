export namespace Console {
  export const debugging = false;

  export function debug(...params: any[]) {
    if (!debugging) return;
    console.debug(...params);
  }
}
