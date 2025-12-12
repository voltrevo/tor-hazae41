import { Ed25519 } from '@hazae41/ed25519';

let done = false;

export async function initWasm() {
  if (done) {
    return;
  }

  // Initialize Ed25519 from native implementation
  Ed25519.set(Ed25519.fromNative());

  done = true;
}
