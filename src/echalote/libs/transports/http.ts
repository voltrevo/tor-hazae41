import { Resizer } from '../resizer/resizer';
import { Bytes } from '../../../hazae41/bytes';
import { Cursor } from '../../../hazae41/cursor/mod';
import { Unknown, Writable } from '../../../hazae41/binary/mod';
import { FullDuplex } from '../../../hazae41/cascade';

export class BatchedFetchStream {
  readonly duplex: FullDuplex<Unknown, Writable>;

  readonly #buffer = new Resizer();

  constructor(readonly request: RequestInfo) {
    this.duplex = new FullDuplex({
      output: {
        write: c => this.#buffer.writeFromOrThrow(c),
      },
    });

    this.loop();
  }

  async loop() {
    while (!this.duplex.closed) {
      try {
        const body = this.#buffer.inner.before;
        this.#buffer.inner.offset = 0;

        const res = await fetch(this.request, { method: 'POST', body });
        const data = Bytes.from(await res.arrayBuffer());

        const chunker = new Cursor(data);

        for (const chunk of chunker.splitOrThrow(16384))
          this.duplex.input.enqueue(new Unknown(chunk));

        continue;
      } catch (e: unknown) {
        this.duplex.error(e);
        break;
      }
    }
  }
}
