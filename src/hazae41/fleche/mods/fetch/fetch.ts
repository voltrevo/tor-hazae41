import { rejectOnAbort } from '../../../signals/mods/signals';
import { HttpClientDuplex } from '../http/client';
import { Bytes } from '../../../bytes';
import { Unknown, Writable } from '../../../binary/mod';
import { Disposer } from '../../../disposer';
import { Nullable } from '../../../common/Nullable';

export interface FetchParams {
  readonly stream: ReadableWritablePair<Unknown, Writable>;
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
        return init.body as ReadableStream<Bytes>;
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
    const rejectOnError = Promise.withResolvers<never>();

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

  const resolveOnHead = Promise.withResolvers<Response>();

  const rejectOnClose = Promise.withResolvers<never>();
  const rejectOnError = Promise.withResolvers<never>();

  const http = new HttpClientDuplex({
    method,
    target,
    headers,

    async head(init) {
      // Per Fetch spec, these statuses cannot have a body argument at all
      // (even if it's an empty stream)
      const isNullBodyStatus =
        init.status === 101 ||
        init.status === 204 ||
        init.status === 205 ||
        init.status === 304;

      if (isNullBodyStatus) {
        // Per Fetch API spec, these statuses must be constructed with null body
        // The HTTP layer ensures no body data via transfer: 'none'
        resolveOnHead.resolve(new Response(null, init));
      } else {
        resolveOnHead.resolve(new Response(this.outer.readable, init));
      }
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

  using rejectPin = rejectOnAbort(signal);
  using rejectOnPipe = Pipe.rejectOnError(http, body);

  return await Promise.race([
    resolveOnHead.promise,
    rejectOnClose.promise,
    rejectOnError.promise,
    rejectPin.get(),
    rejectOnPipe.get(),
  ]);
}
