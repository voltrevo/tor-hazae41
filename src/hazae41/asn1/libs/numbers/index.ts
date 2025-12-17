export namespace Numbers {
  /**
   * x is safe integer && x >= 0
   * @param x
   * @returns
   */
  export function isSafeNonNegativeInteger(x: number) {
    return Number.isSafeInteger(x) && x >= 0;
  }
}
