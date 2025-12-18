import { TurboDuplex } from './turbo/stream';
import { Unknown, Writable } from '../../../binary/mod';
import { KcpDuplex } from '../../../kcp';
import { SmuxDuplex } from '../../../smux';

export function createSnowflakeStream(raw: {
  outer: ReadableWritablePair<Unknown, Writable>;
}): { outer: ReadableWritablePair<Unknown, Writable> } {
  const turbo = new TurboDuplex();
  const kcp = new KcpDuplex({ lowDelay: 100, highDelay: 1000 });
  const smux = new SmuxDuplex();

  raw.outer.readable.pipeTo(turbo.inner.writable).catch(() => {});
  turbo.inner.readable.pipeTo(raw.outer.writable).catch(() => {});

  turbo.outer.readable.pipeTo(kcp.inner.writable).catch(() => {});
  kcp.inner.readable.pipeTo(turbo.outer.writable).catch(() => {});

  kcp.outer.readable.pipeTo(smux.inner.writable).catch(() => {});
  smux.inner.readable.pipeTo(kcp.outer.writable).catch(() => {});

  return smux;
}
