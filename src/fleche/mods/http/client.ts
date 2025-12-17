import {
  FullDuplex,
  SimplexParams,
  SuperReadableStream,
  SuperWritableStream,
} from '../../../hazae41/cascade';
import { Nullable } from '../../libs/nullable/index';
import { Awaitable } from '../../libs/promises/index';
import { Resizer } from '../../libs/resizer/resizer';
import { Strings } from '../../libs/strings/strings';
import { Console } from '../console/index';
import {
  ContentLengthOverflowError,
  InvalidHttpStateError,
  UnsupportedContentEncoding,
  UnsupportedTransferEncoding,
} from './errors.js';
import {
  HttpCompression,
  HttpHeadedState,
  HttpHeadingState,
  HttpState,
  HttpTransfer,
  HttpUpgradingState,
} from './state.js';
import { Bytes } from '../../../hazae41/bytes';
import { Unknown, Writable } from '../../../hazae41/binary/mod';
import { Future } from '../../../hazae41/future';

export namespace Lines {
  export const rn = Bytes.fromUtf8('\r\n');
  export const rnrn = Bytes.fromUtf8('\r\n\r\n');
}

export interface HttpStreamParams {
  readonly method: string;

  readonly target: string;

  readonly headers: Headers;

  readonly input?: SimplexParams<Unknown, Writable>;

  close?(this: HttpClientDuplex): Awaitable<void>;

  error?(this: HttpClientDuplex, reason?: unknown): Awaitable<void>;

  head?(this: HttpClientDuplex, init: ResponseInit): Awaitable<void>;
}

export class HttpClientDuplex {
  readonly #class = HttpClientDuplex;

  readonly duplex: FullDuplex<Unknown, Writable, Bytes, Bytes>;

  #resolveOnStart = new Future<void>();

  #state: HttpState = { type: 'none' };

  /**
   * Create a new HTTP 1.1 stream
   * @param subduplex
   */
  constructor(readonly params: HttpStreamParams) {
    this.duplex = new FullDuplex<Unknown, Writable, Bytes, Bytes>({
      input: {
        write: m => this.#onInputWrite(m),
        close: () => this.#onInputClose(),
      },
      output: {
        start: () => this.#onOutputStart(),
        write: m => this.#onOutputWrite(m),
        close: () => this.#onOutputClose(),
      },
      close: () => this.params.close?.call(this),
      error: e => this.params.error?.call(this, e),
    });

    this.#resolveOnStart.resolve();
  }

  [Symbol.dispose]() {
    this.close();
  }

  get inner() {
    return this.duplex.inner;
  }

  get outer() {
    return this.duplex.outer;
  }

  get input() {
    return this.duplex.input;
  }

  get output() {
    return this.duplex.output;
  }

  get closing() {
    return this.duplex.closing;
  }

  get closed() {
    return this.duplex.closed;
  }

  error(reason?: unknown) {
    this.duplex.error(reason);
  }

  close() {
    this.duplex.close();
  }

  async #onInputWrite(chunk: Unknown) {
    Console.debug(
      this.constructor.name,
      '<-',
      chunk.bytes.length,
      Bytes.toUtf8(chunk.bytes)
    );

    let bytes = chunk.bytes;

    if (this.#state.type === 'heading' || this.#state.type === 'upgrading') {
      const body = await this.#onReadHead(bytes, this.#state);

      if (!body?.length) return;

      bytes = body;
    }

    if (this.#state.type === 'upgraded') {
      this.duplex.input.enqueue(bytes);
      return;
    }

    if (this.#state.type === 'headed') {
      if (this.#state.server_transfer.type === 'none')
        return await this.#onReadNoneBody(bytes, this.#state);
      if (this.#state.server_transfer.type === 'lengthed')
        return await this.#onReadLenghtedBody(bytes, this.#state);
      if (this.#state.server_transfer.type === 'chunked')
        return await this.#onReadChunkedBody(bytes, this.#state);
    }

    throw new InvalidHttpStateError();
  }

  async #onInputClose() {
    if (this.#state.type === 'headed') {
      const { server_transfer, server_compression } = this.#state;

      // For "none" transfer type, connection close signals end of response
      if (server_transfer.type === 'none' && server_compression) {
        // First close the sourcer to signal end of input
        server_compression.sourcer.close();

        // Then wait for the decompression pipeline to complete
        await server_compression.pipeline;
      }
    }
  }

  #getTransferOrThrow(headers: Headers): HttpTransfer {
    const type = headers.get('Transfer-Encoding');

    if (type === 'chunked') {
      const buffer = new Resizer();
      return { type, buffer };
    }

    if (type === null) {
      const length = headers.get('Content-Length');

      if (length) {
        return { type: 'lengthed', length: Number(length), offset: 0 };
      } else {
        return { type: 'none' };
      }
    }

    throw new UnsupportedTransferEncoding(type);
  }

  async #getCompressionStreamOrNull(
    type: string
  ): Promise<Nullable<CompressionStream>> {
    if (type === 'gzip') return new CompressionStream('gzip');
    if (type === 'deflate') return new CompressionStream('deflate');
    return null;
  }

  async #getCompressionOrNullOrThrow(
    headers: Headers
  ): Promise<Nullable<HttpCompression>> {
    const type = headers.get('Content-Encoding');

    if (type === null) return undefined;

    const encoder = await this.#getCompressionStreamOrNull(type);

    if (encoder == null) throw new UnsupportedContentEncoding(type);

    const sourcer = new SuperReadableStream<Bytes>({});

    const sinker = new SuperWritableStream<Bytes>({
      write: c => this.duplex.output.enqueue(new Unknown(c)),
      abort: e => this.duplex.output.error(e),
      close: () => this.duplex.output.close(),
    });

    const pipeline = sourcer.substream
      .pipeThrough(encoder)
      .pipeTo(sinker.substream)
      .catch(() => {});

    return { sourcer, pipeline };
  }

  async #getDecompressionStreamOrNull(
    type: string
  ): Promise<Nullable<DecompressionStream>> {
    if (type === 'gzip') return new DecompressionStream('gzip');
    if (type === 'deflate') return new DecompressionStream('deflate');
    return null;
  }

  async #getDecompressionOrNullOrThrow(
    headers: Headers
  ): Promise<Nullable<HttpCompression>> {
    const type = headers.get('Content-Encoding');

    if (type === null) return undefined;

    const decoder = await this.#getDecompressionStreamOrNull(type);

    if (decoder == null) throw new UnsupportedContentEncoding(type);

    const sourcer = new SuperReadableStream<Bytes>({});

    const sinker = new SuperWritableStream<Bytes>({
      write: c => this.duplex.input.enqueue(c),
      abort: e => this.duplex.input.error(e),
      close: () => this.duplex.input.close(),
    });

    const pipeline = sourcer.substream
      .pipeThrough(decoder)
      .pipeTo(sinker.substream)
      .catch(() => {});

    return { sourcer, pipeline };
  }

  async #onReadHead(
    chunk: Bytes,
    state: HttpHeadingState | HttpUpgradingState
  ): Promise<Nullable<Bytes>> {
    const { buffer } = state;

    buffer.writeOrThrow(chunk);

    const split = Bytes.indexOf(buffer.inner.before, Lines.rnrn);

    if (split === -1) return undefined;

    const rawHead = buffer.inner.before.subarray(0, split);
    const rawBody = buffer.inner.before.subarray(split + Lines.rnrn.length);

    const [rawStatus, ...rawHeaders] = Bytes.toUtf8(rawHead).split('\r\n');
    const [_version, statusString, statusText] = rawStatus.split(' ');

    const status = Number(statusString);
    const headers = new Headers(
      rawHeaders.map(it => Strings.splitOnFirst(it, ': '))
    );

    if (state.type === 'upgrading') {
      this.#state = { ...state, type: 'upgraded' };
    } else {
      const server_transfer = this.#getTransferOrThrow(headers);
      const server_compression =
        await this.#getDecompressionOrNullOrThrow(headers);
      this.#state = {
        ...state,
        type: 'headed',
        server_transfer,
        server_compression,
      };
    }

    await this.params.head?.call(this, { headers, status, statusText });

    return Bytes.from(rawBody);
  }

  async #onReadNoneBody(chunk: Bytes, state: HttpHeadedState) {
    if (state.server_transfer.type !== 'none')
      throw new InvalidHttpStateError();

    const { server_compression } = state;

    if (server_compression == null) {
      this.duplex.input.enqueue(chunk);
    } else {
      server_compression.sourcer.enqueue(chunk);
    }
  }

  async #onReadLenghtedBody(chunk: Bytes, state: HttpHeadedState) {
    if (state.server_transfer.type !== 'lengthed')
      throw new InvalidHttpStateError();

    const { server_transfer, server_compression } = state;

    server_transfer.offset += chunk.length;

    if (server_transfer.offset > server_transfer.length)
      throw new ContentLengthOverflowError(
        server_transfer.offset,
        server_transfer.length
      );

    if (server_compression == null) {
      this.duplex.input.enqueue(chunk);
    } else {
      server_compression.sourcer.enqueue(chunk);
    }

    if (server_transfer.offset === server_transfer.length) {
      if (server_compression == null) {
        this.duplex.input.close();
      } else {
        server_compression.sourcer.close();
      }
    }
  }

  async #onReadChunkedBody(chunk: Bytes, state: HttpHeadedState) {
    if (state.server_transfer.type !== 'chunked')
      throw new InvalidHttpStateError();

    const { server_transfer, server_compression } = state;
    const { buffer } = server_transfer;

    buffer.writeOrThrow(chunk);

    let slice = buffer.inner.before;

    while (slice.length) {
      const index = Bytes.indexOf(slice, Lines.rn);

      /**
       * no \r\n
       *  => partial chunk header
       *  => wait for more data
       */
      if (index === -1) return;

      /**
       * [length]\r\n(rest)
       *  => full chunk header
       *  => extract length
       */

      const lengthBytes = slice.subarray(0, index);
      const lengthUtf8 = Bytes.toUtf8(lengthBytes);
      const length = parseInt(lengthUtf8, 16);

      let rest = slice.subarray(index + 2);

      /**
       * length === 0
       *  => end of chunks
       *  => close the stream
       */
      if (length === 0) {
        /**
         * Close the stream
         */
        if (server_compression == null) {
          this.duplex.input.close();
        } else {
          server_compression.sourcer.close();
        }

        return;
      }

      /**
       * len(rest) < length + len(\r\n)
       *  => partial chunk body
       *  => wait for more data
       */
      if (rest.length < length + Lines.rn.length) return;

      /**
       * ([length]\r\n)[chunk]\r\n(rest)
       *  => full chunk body
       *  => split body and rest
       */

      /**
       * Copy the body
       */
      const body = rest.slice(0, length);

      /**
       * Rest is at the end of the chunk + len(\r\n)
       */
      rest = rest.subarray(length + Lines.rn.length);

      /**
       * Enqueue the body
       */
      if (server_compression == null) {
        this.duplex.input.enqueue(body);
      } else {
        server_compression.sourcer.enqueue(body);
      }

      /**
       * Overwrite the buffer with the rest
       */
      buffer.inner.offset = 0;
      buffer.writeOrThrow(rest);

      /**
       * Search for other chunks in the rest
       */
      slice = buffer.inner.before;
    }
  }

  async #onOutputStart() {
    await this.#resolveOnStart.promise;

    const { method, target, headers } = this.params;

    let head = `${method} ${target} HTTP/1.1\r\n`;
    headers.forEach((v, k) => (head += `${k}: ${v}\r\n`));
    head += `\r\n`;

    Console.debug(this.constructor.name, '->', head.length, head);
    this.duplex.output.enqueue(new Unknown(Bytes.fromUtf8(head)));

    const buffer = new Resizer();

    if (Strings.equalsIgnoreCase(headers.get('Connection'), 'Upgrade')) {
      this.#state = { type: 'upgrading', buffer };
    } else {
      const client_transfer = this.#getTransferOrThrow(headers);
      const client_compression =
        await this.#getCompressionOrNullOrThrow(headers);
      this.#state = {
        type: 'heading',
        buffer,
        client_transfer,
        client_compression,
      };
    }
  }

  async #onOutputWrite(chunk: Bytes) {
    Console.debug(this.constructor.name, '->', Bytes.toUtf8(chunk));

    if (this.#state.type === 'upgrading' || this.#state.type === 'upgraded') {
      this.duplex.output.enqueue(new Unknown(chunk));
      return;
    }

    if (this.#state.type === 'heading' || this.#state.type === 'headed') {
      if (this.#state.client_transfer.type === 'none')
        return await this.#onWriteNone(chunk, this.#state);
      if (this.#state.client_transfer.type === 'lengthed')
        return await this.#onWriteLengthed(chunk, this.#state);
      if (this.#state.client_transfer.type === 'chunked')
        return await this.#onWriteChunked(chunk, this.#state);
    }

    throw new InvalidHttpStateError();
  }

  async #onWriteNone(chunk: Bytes, state: HttpHeadingState | HttpHeadedState) {
    const { client_compression } = state;

    if (client_compression == null) {
      this.duplex.output.enqueue(new Unknown(chunk));
    } else {
      client_compression.sourcer.enqueue(chunk);
    }
  }

  async #onWriteLengthed(
    chunk: Bytes,
    state: HttpHeadingState | HttpHeadedState
  ) {
    if (state.client_transfer.type !== 'lengthed')
      throw new InvalidHttpStateError();

    const { client_transfer, client_compression } = state;

    client_transfer.offset += chunk.length;

    if (client_transfer.offset > client_transfer.length)
      throw new ContentLengthOverflowError(
        client_transfer.offset,
        client_transfer.length
      );

    if (client_compression == null) {
      this.duplex.output.enqueue(new Unknown(chunk));
    } else {
      client_compression.sourcer.enqueue(chunk);
    }
  }

  async #onWriteChunked(
    chunk: Bytes,
    state: HttpHeadingState | HttpHeadedState
  ) {
    const text = new TextDecoder().decode(chunk);
    const length = text.length.toString(16);
    const line = `${length}\r\n${text}\r\n`;

    // Console.debug(this.constructor.name, "->", line.length, line)

    const { client_compression } = state;

    if (client_compression == null) {
      this.duplex.output.enqueue(new Unknown(Bytes.fromUtf8(line)));
    } else {
      client_compression.sourcer.enqueue(Bytes.fromUtf8(line));
    }
  }

  async #onOutputClose() {
    if (this.#state.type === 'heading') {
      if (this.#state.client_transfer.type === 'none') {
        this.duplex.output.enqueue(new Unknown(Bytes.fromUtf8(`\r\n`)));
        return;
      }

      if (this.#state.client_transfer.type === 'chunked') {
        this.duplex.output.enqueue(new Unknown(Bytes.fromUtf8(`0\r\n\r\n`)));
        return;
      }
    }
  }
}
