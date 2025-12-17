import { Bytes } from '../../../../hazae41/bytes/index.js';
import { ServerECDHParams } from '../../../index.js';

export interface ECDH {
  readonly ecdh_Yc: Bytes;
  readonly ecdh_Z: Bytes;
}

export class Secp256r1 {
  async computeOrThrow(server_ecdh_params: ServerECDHParams) {
    const yc = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits']
    );

    const ecdh_Yc = Bytes.from(
      await crypto.subtle.exportKey('raw', yc.publicKey)
    );
    const ecdh_Ys = server_ecdh_params.public_point.point.value.bytes;

    const Ys = await crypto.subtle.importKey(
      'raw',
      ecdh_Ys,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const ecdh_Z = Bytes.from(
      await crypto.subtle.deriveBits(
        { name: 'ECDH', public: Ys },
        yc.privateKey,
        256
      )
    );

    return { ecdh_Yc, ecdh_Z } satisfies ECDH;
  }
}
