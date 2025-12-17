import { Nullable } from "../../libs/nullable/index.ts"
import { Deferred } from "../deferred/index.ts"
import { Wrap } from "../wrap/index.ts"

export class MovedError extends Error {
  readonly #class = MovedError
  readonly name = this.#class.name

  constructor() {
    super(`Resource is moved`)
  }
}

export interface Movable<T> {

  readonly moved: boolean

  get(): T

  getOrNull(): Nullable<T>

  getOrThrow(): T

  checkOrNull(): Nullable<this>

  checkOrThrow(): this

  unwrapOrNull(): Nullable<T>

  unwrapOrThrow(): T

  moveOrNull(): Nullable<Move<T>>

  moveOrThrow(): Move<T>

}

/**
 * A movable reference
 */
export class Move<T> implements Disposable, Movable<T> {

  #moved = false

  /**
   * An movable reference
   * @param value 
   */
  constructor(
    readonly value: T,
    readonly clean: Disposable
  ) { }

  static wrap<T extends Disposable>(value: T) {
    return new Move(value, value)
  }

  static from<T>(value: Wrap<T>) {
    return new Move(value.get(), value)
  }

  static with<T>(value: T, clean: (value: T) => void) {
    return new Move(value, new Deferred(() => clean(value)))
  }

  [Symbol.dispose]() {
    if (this.#moved)
      return

    this.clean[Symbol.dispose]()
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]()
  }

  get moved() {
    return this.#moved
  }

  /**
   * Get the value
   * @returns T
   */
  get() {
    return this.value
  }

  /**
   * Get the value or null-like if not owned
   * @returns T or null-like if not owned
   */
  getOrNull(): Nullable<T> {
    if (this.#moved)
      return

    return this.value
  }

  /**
   * Get the value or throw if not owned
   * @returns T
   * @throws NotOwnedError if not owned
   */
  getOrThrow(): T {
    if (this.#moved)
      throw new MovedError()

    return this.value
  }

  checkOrNull(): Nullable<this> {
    if (this.#moved)
      return

    return this
  }

  checkOrThrow(): this {
    if (this.#moved)
      throw new MovedError()

    return this
  }

  /**
   * Get the value and set this as moved or null-like if not owned
   * @returns T or null-like if not owned
   */
  unwrapOrNull(): Nullable<T> {
    if (this.#moved)
      return

    this.#moved = true

    return this.value
  }

  /**
   * Get the value and set this as moved or throw if not owned
   * @returns T
   * @throws DroppedError if not owned
   */
  unwrapOrThrow(): T {
    if (this.#moved)
      throw new MovedError()

    this.#moved = true

    return this.value
  }

  /**
   * Move the value to a new Unpin and set this one as moved or null-like if already moved
   * @returns Unpin<T> or null-like if moved
   */
  moveOrNull(): Nullable<Move<T>> {
    if (this.#moved)
      return

    this.#moved = true

    return new Move(this.value, this.clean)
  }

  /**
   * Move the value to a new Unpin and set this one as moved or throw if already moved
   * @returns Unpin<T>
   * @throws DroppedError if already moved
   */
  moveOrThrow(): Move<T> {
    if (this.#moved)
      throw new MovedError()

    this.#moved = true

    return new Move(this.value, this.clean)
  }

}