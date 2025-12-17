export class SuperReadableStream<R> {
  readonly source: SuperUnderlyingDefaultSource<R>;

  readonly substream: ReadableStream<R>;

  /**
   * Like a ReadableStream but with a getter to its controller
   * @param subsource
   * @param strategy
   */
  constructor(
    readonly subsource: UnderlyingDefaultSource<R>,
    readonly strategy?: QueuingStrategy<R>
  ) {
    this.source = new SuperUnderlyingDefaultSource(subsource);
    this.substream = new ReadableStream(this.source, strategy);
  }

  [Symbol.dispose]() {
    this.close();
  }

  get controller() {
    return this.source.controller;
  }

  enqueue(chunk?: R) {
    this.controller.enqueue(chunk);
  }

  error(reason?: unknown) {
    this.controller.error(reason);
  }

  close() {
    this.controller.close();
  }
}

export class SuperUnderlyingDefaultSource<
  R,
> implements UnderlyingDefaultSource<R> {
  #controller?: ReadableStreamDefaultController<R>;

  constructor(readonly inner: UnderlyingDefaultSource<R>) {}

  get controller() {
    return this.#controller!;
  }

  start(controller: ReadableStreamDefaultController<R>) {
    this.#controller = controller;

    return this.inner.start?.(controller);
  }

  pull(controller: ReadableStreamDefaultController<R>) {
    return this.inner.pull?.(controller);
  }

  cancel(reason?: unknown) {
    return this.inner.cancel?.(reason);
  }
}
