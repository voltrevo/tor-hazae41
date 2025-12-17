
export class SuperTransformStream<I, O> {

  readonly transformer: SuperTransformer<I, O>

  readonly substream: TransformStream<I, O>

  /**
   * Like a TransformStream but with a getter to its controller
   * @param subtransformer 
   * @param writableStrategy 
   * @param readableStrategy 
   */
  constructor(
    readonly subtransformer: Transformer<I, O>,
    readonly writableStrategy?: QueuingStrategy<I>,
    readonly readableStrategy?: QueuingStrategy<O>
  ) {
    this.transformer = new SuperTransformer(subtransformer)
    this.substream = new TransformStream(this.transformer, writableStrategy, readableStrategy)
  }

  [Symbol.dispose]() {
    this.terminate()
  }

  get controller() {
    return this.transformer.controller
  }

  enqueue(chunk?: O) {
    this.controller.enqueue(chunk)
  }

  error(reason?: unknown) {
    this.controller.error(reason)
  }

  terminate() {
    this.controller.terminate()
  }

}

export class SuperTransformer<I, O> implements Transformer<I, O> {

  #controller?: TransformStreamDefaultController<O>

  constructor(
    readonly inner: Transformer<I, O>
  ) { }

  get controller() {
    return this.#controller!
  }

  start(controller: TransformStreamDefaultController<O>) {
    this.#controller = controller

    return this.inner.start?.(controller)
  }

  transform(chunk: I, controller: TransformStreamDefaultController<O>) {
    return this.inner.transform?.(chunk, controller)
  }

  flush(controller: TransformStreamDefaultController<O>) {
    return this.inner.flush?.(controller)
  }

}