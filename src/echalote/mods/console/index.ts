export namespace Console {
  export const debugging = false;

  export function log(...params: unknown[]) {
    if (!debugging) return;
    console.log(...params);
  }

  export function debug(...params: unknown[]) {
    if (!debugging) return;
    console.debug(...params);
  }

  export function error(...params: unknown[]) {
    if (!debugging) return;
    console.error(...params);
  }

  export function warn(...params: unknown[]) {
    if (!debugging) return;
    console.warn(...params);
  }
}
