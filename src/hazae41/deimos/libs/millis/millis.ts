export namespace Millis {

  export function toUnitString(millis: number) {
    if (millis > 1000)
      return `${(millis / 1000).toFixed(2)} s`
    if (millis > 1)
      return `${millis.toFixed(2)} ms`
    if (millis > 0.001)
      return `${(millis * 1000).toFixed(2)} μs`
    return `${(millis * 1000 * 1000).toFixed(2)} ns`
  }

}