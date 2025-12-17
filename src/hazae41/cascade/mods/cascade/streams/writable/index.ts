export class SuperWritableStream<W> {

  readonly sink: SuperUnderlyingSink<W>

  readonly substream: WritableStream<W>

  /**
   * Like a WritableStream but with a getter to its controller
   * @param subsink 
   * @param strategy 
   */
  constructor(
    readonly subsink: UnderlyingSink<W>,
    readonly strategy?: QueuingStrategy<W>
  ) {
    this.sink = new SuperUnderlyingSink(subsink)
    this.substream = new WritableStream(this.sink, strategy)
  }

  [Symbol.dispose]() {
    this.error()
  }

  get controller() {
    return this.sink.controller
  }

  get signal() {
    return this.controller.signal
  }

  error(reason?: unknown) {
    this.controller.error(reason)
  }

}

export class SuperUnderlyingSink<W> implements UnderlyingSink<W> {

  #controller?: WritableStreamDefaultController

  constructor(
    readonly inner: UnderlyingSink<W>
  ) { }

  get controller() {
    return this.#controller!
  }

  start(controller: WritableStreamDefaultController) {
    this.#controller = controller

    return this.inner.start?.(controller)
  }

  write(chunk: W, controller: WritableStreamDefaultController) {
    return this.inner.write?.(chunk, controller)
  }

  abort(reason?: unknown) {
    return this.inner.abort?.(reason)
  }

  close() {
    return this.inner.close?.()
  }

}