import { Nullable } from '../../libs/nullable/index';
import { Bytes } from '../../../bytes';
import { SuperReadableStream } from '../../../cascade';
import { Resizer } from '../../../common/Resizer';

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
  readonly sourcer: SuperReadableStream<Bytes>;
  readonly pipeline: Promise<void>;
}
