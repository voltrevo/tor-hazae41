import { sha3 } from 'hash-wasm';
import { never } from './never.js';

export async function hash(
  ...args: (string | number | Uint8Array)[]
): Promise<Uint8Array> {
  let len = 0;

  for (const arg of args) {
    if (typeof arg === 'string') {
      len += new TextEncoder().encode(arg).length;
    } else if (typeof arg === 'number') {
      len += 8;
    } else if (arg instanceof Uint8Array) {
      len += arg.length;
    } else {
      never(arg);
    }
  }

  const buf = new ArrayBuffer(len);
  const uint8View = new Uint8Array(buf);
  const dataView = new DataView(buf);
  let offset = 0;

  for (const arg of args) {
    if (typeof arg === 'string') {
      const bytes = new TextEncoder().encode(arg);
      uint8View.set(bytes, offset);
      offset += bytes.length;
    } else if (typeof arg === 'number') {
      dataView.setBigUint64(offset, BigInt(arg));
      offset += 8;
    } else if (arg instanceof Uint8Array) {
      uint8View.set(arg, offset);
      offset += arg.length;
    } else {
      never(arg);
    }
  }

  const digestHex = await sha3(uint8View, 256);
  // Convert hex string to Uint8Array
  const digest = new Uint8Array(
    digestHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) ?? []
  );
  return digest;
}
