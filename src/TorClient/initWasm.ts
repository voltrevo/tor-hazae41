import { ChaCha20Poly1305Wasm } from '@hazae41/chacha20poly1305.wasm';
import { ChaCha20Poly1305 } from '@hazae41/chacha20poly1305';
import { Ed25519 } from '@hazae41/ed25519';
import { X25519Wasm } from '@hazae41/x25519.wasm';
import { X25519 } from '@hazae41/x25519';

let done = false;

export async function initWasm() {
  if (done) {
    return;
  }

  await Promise.all([
    ChaCha20Poly1305Wasm.initBundled(),
    X25519Wasm.initBundled(),
  ]);

  ChaCha20Poly1305.set(ChaCha20Poly1305.fromWasm(ChaCha20Poly1305Wasm));
  Ed25519.set(Ed25519.fromNative());
  X25519.set(X25519.fromWasm(X25519Wasm));

  done = true;
}
