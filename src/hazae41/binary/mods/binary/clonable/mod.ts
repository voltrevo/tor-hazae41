/**
 * A clonable binary data type
 */
export interface Clonable<Output = unknown> {

  /**
   * Deep clone this object
   */
  cloneOrThrow(): Output

}

export namespace Clonable {

  export type Infer<Self, Output = unknown> = Clonable<Output & Clonable.Output<Self>>

  export type Output<Self> = Self extends Clonable<infer Output> ? Output : never

}