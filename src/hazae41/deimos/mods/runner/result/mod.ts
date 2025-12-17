import { Millis } from "../../../libs/millis/millis.ts"

export class Result {

  constructor(
    readonly message: string,
    readonly samples: number,
    readonly average: number,
    readonly minimum: number,
    readonly maximum: number,
    readonly results: number[]
  ) { }

  /**
   * How much faster is this compared to other
   * @param other 
   * @returns 
   */
  ratio(other: Result): number {
    return other.average / this.average
  }

  table(...others: Result[]) {
    const results = [this, ...others]

    const rows: Record<string, unknown> = {}

    for (const result of results) {
      const average = `${Millis.toUnitString(result.average)}/iter`
      const minimum = Millis.toUnitString(result.minimum)
      const maximum = Millis.toUnitString(result.maximum)
      rows[result.message] = { average, minimum, maximum }
    }

    console.table(rows)
  }

  summary(...others: Result[]) {
    for (const other of others) console.info(`- ${this.message} is ${this.ratio(other).toFixed(2)}x faster than ${other.message}`)
  }

  tableAndSummary(...others: Result[]) {
    this.table(...others)
    console.info()
    this.summary(...others)
  }
}