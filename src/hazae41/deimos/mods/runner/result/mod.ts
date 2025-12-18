export class Result {
  constructor(
    readonly message: string,
    readonly samples: number,
    readonly average: number,
    readonly minimum: number,
    readonly maximum: number,
    readonly results: number[]
  ) {}

  /**
   * How much faster is this compared to other
   * @param other
   * @returns
   */
  ratio(other: Result): number {
    return other.average / this.average;
  }

  table(...others: Result[]) {
    const results = [this, ...others];

    const rows: Record<string, unknown> = {};

    for (const result of results) {
      const average = `${toUnitString(result.average)}/iter`;
      const minimum = toUnitString(result.minimum);
      const maximum = toUnitString(result.maximum);
      rows[result.message] = { average, minimum, maximum };
    }

    console.table(rows);
  }

  summary(...others: Result[]) {
    for (const other of others)
      console.info(
        `- ${this.message} is ${this.ratio(other).toFixed(2)}x faster than ${other.message}`
      );
  }

  tableAndSummary(...others: Result[]) {
    this.table(...others);
    console.info();
    this.summary(...others);
  }
}

function toUnitString(millis: number) {
  if (millis > 1000) return `${(millis / 1000).toFixed(2)} s`;
  if (millis > 1) return `${millis.toFixed(2)} ms`;
  if (millis > 0.001) return `${(millis * 1000).toFixed(2)} μs`;
  return `${(millis * 1000 * 1000).toFixed(2)} ns`;
}
