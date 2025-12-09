import { Opaque, Writable } from '@hazae41/binary';
import { HalfDuplex } from '@hazae41/cascade';

export interface WebSocketDuplexParams {
  /**
   * Whether the socket should be closed when the duplex is closed
   * @description You don't want to reuse the socket
   * @description You're not using request-response
   */
  readonly shouldCloseOnClose?: boolean;

  /**
   * Whether the socket should be closed when the duplex is errored
   * @description You don't want to reuse the socket
   */
  readonly shouldCloseOnError?: boolean;
}

export class WebSocketDuplex {
  readonly duplex: HalfDuplex<Opaque, Writable>;

  constructor(
    readonly socket: WebSocket,
    readonly params: WebSocketDuplexParams = {}
  ) {
    const { shouldCloseOnError, shouldCloseOnClose } = params;

    this.duplex = new HalfDuplex<Opaque, Writable>({
      output: {
        write(message) {
          socket.send(Writable.writeToBytesOrThrow(message));
        },
      },
      close() {
        if (!shouldCloseOnClose) return;

        try {
          socket.close();
        } catch {
          // ignore
        }
      },
      error() {
        if (!shouldCloseOnError) return;

        try {
          socket.close();
        } catch {
          // ignore
        }
      },
    });

    socket.addEventListener('close', () => this.duplex.close());
    socket.addEventListener('error', e => this.duplex.error(e));

    socket.addEventListener(
      'message',
      async (e: MessageEvent<string | ArrayBuffer>) => {
        if (typeof e.data === 'string') return;

        const bytes = new Uint8Array(e.data);
        const opaque = new Opaque(bytes);

        this.duplex.input.enqueue(opaque);
      }
    );
  }

  static async connect(
    url: string,
    signal: AbortSignal = new AbortController().signal
  ) {
    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';

    await waitForWebSocket(socket, signal);

    return new WebSocketDuplex(socket);
  }

  [Symbol.dispose]() {
    this.close();
  }

  get outer() {
    return this.duplex.outer;
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
}

export async function waitForWebSocket(
  socket: WebSocket,
  signal: AbortSignal = new AbortController().signal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onOpen = (): void => {
      cleanup();
      resolve();
    };
    const onError = (e: Event): void => {
      cleanup();
      reject(e);
    };
    const onClose = (e: CloseEvent): void => {
      cleanup();
      reject(e);
    };
    const onAbort = (): void => {
      cleanup();
      reject(new Error('Aborted'));
    };

    const cleanup = (): void => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('close', onClose);
      socket.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };

    socket.addEventListener('open', onOpen, { passive: true });
    socket.addEventListener('close', onClose, { passive: true });
    socket.addEventListener('error', onError, { passive: true });
    signal.addEventListener('abort', onAbort, { passive: true });
  });
}
