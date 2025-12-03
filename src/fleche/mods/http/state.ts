import { SuperReadableStream } from '@hazae41/cascade';
import { Nullable } from '../../libs/nullable/index';
import { Resizer } from '../../libs/resizer/resizer';

export type HttpState =
  | HttpNoneState
  | HttpHeadingState
  | HttpHeadedState
  | HttpUpgradingState
  | HttpUpgradedState;

export interface HttpNoneState {
  readonly type: 'none';
}

export interface HttpUpgradingState {
  readonly type: 'upgrading';
  readonly buffer: Resizer;
}

export interface HttpUpgradedState {
  readonly type: 'upgraded';
}

export interface HttpHeadingState {
  readonly type: 'heading';
  readonly buffer: Resizer;

  readonly client_transfer: HttpTransfer;
  readonly client_compression?: Nullable<HttpCompression>;
}

export interface HttpHeadedState {
  readonly type: 'headed';

  readonly client_transfer: HttpTransfer;
  readonly server_transfer: HttpTransfer;

  readonly client_compression?: Nullable<HttpCompression>;
  readonly server_compression?: Nullable<HttpCompression>;
}

export type HttpTransfer =
  | HttpNoneTransfer
  | HttpLengthedTransfer
  | HttpChunkedTransfer;

export interface HttpChunkedTransfer {
  readonly type: 'chunked';
  readonly buffer: Resizer;
}

export interface HttpNoneTransfer {
  readonly type: 'none';
}

export interface HttpLengthedTransfer {
  readonly type: 'lengthed';
  readonly length: number;

  offset: number;
}

export interface HttpCompression {
  readonly sourcer: SuperReadableStream<Uint8Array>;
  readonly pipeline: Promise<void>;
}
