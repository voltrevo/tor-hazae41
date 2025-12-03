import { Opaque, Writable } from '@hazae41/binary';
import { Disposer } from '@hazae41/disposer';
import { Future } from '@hazae41/future';
import { Signals } from '@hazae41/signals';
import { Nullable } from '../../libs/nullable/index';
import { HttpClientDuplex } from '../http/client';

export interface FetchParams {
  readonly stream: ReadableWritablePair<Opaque, Writable>;
  readonly preventAbort?: boolean;
  readonly preventCancel?: boolean;
  readonly preventClose?: boolean;
}

namespace Requests {
  export async function getBody(request: Request, init: RequestInit) {
    /**
     * Firefox fix
     */
    if (request.body == null && init.body != null) {
      if (init.body instanceof ReadableStream) {
        return init.body as ReadableStream<Uint8Array>;
      } else {
        const blob = await request.blob();
        return blob.stream();
      }
    }

    return request.body;
  }
}

namespace Pipe {
  export function rejectOnError(
    http: HttpClientDuplex,
    body: Nullable<ReadableStream<Uint8Array>>
  ) {
    const rejectOnError = new Future<never>();

    const controller = new AbortController();
    const { signal } = controller;

    if (body != null)
      body
        .pipeTo(http.outer.writable, { signal })
        .catch(cause => rejectOnError.reject(new Error('Errored', { cause })));
    else
      http.outer.writable
        .close()
        .catch(cause => rejectOnError.reject(new Error('Errored', { cause })));

    return new Disposer(rejectOnError.promise, () => controller.abort());
  }
}

/**
 * Fetch adapter for HTTP streams
 * Will wait for response to be available
 * @param input "https://google.com"
 * @param init.stream Transport substream
 * @returns
 */
export async function fetch(
  input: RequestInfo | URL,
  init: RequestInit & FetchParams
): Promise<Response> {
  const { stream, preventAbort, preventCancel, preventClose, ...others } = init;

  const request = new Request(input, others);
  const body = await Requests.getBody(request, others);

  const { url, method, signal } = request;
  const { host, pathname, search } = new URL(url);

  const target = pathname + search;
  const headers = new Headers(init.headers);

  if (!headers.has('Host')) headers.set('Host', host);
  if (!headers.has('Connection')) headers.set('Connection', 'keep-alive');
  if (!headers.has('Transfer-Encoding') && !headers.has('Content-Length'))
    headers.set('Transfer-Encoding', 'chunked');
  if (!headers.has('Accept-Encoding'))
    headers.set('Accept-Encoding', 'gzip, deflate');

  const resolveOnHead = new Future<Response>();

  const rejectOnClose = new Future<never>();
  const rejectOnError = new Future<never>();

  const http = new HttpClientDuplex({
    method,
    target,
    headers,

    head(init) {
      resolveOnHead.resolve(new Response(this.outer.readable, init));
    },
    error(cause) {
      rejectOnError.reject(new Error('Errored', { cause }));
    },
    close() {
      rejectOnClose.reject(new Error('Closed'));
    },
  });

  stream.readable
    .pipeTo(http.inner.writable, { signal, preventCancel })
    .catch(() => {});
  http.inner.readable
    .pipeTo(stream.writable, { signal, preventClose, preventAbort })
    .catch(() => {});

  using rejectOnAbort = Signals.rejectOnAbort(signal);
  using rejectOnPipe = Pipe.rejectOnError(http, body);

  return await Promise.race([
    resolveOnHead.promise,
    rejectOnClose.promise,
    rejectOnError.promise,
    rejectOnAbort.get(),
    rejectOnPipe.get(),
  ]);
}
