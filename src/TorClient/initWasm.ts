let done = false;

export async function initWasm() {
  if (done) {
    return;
  }

  // No initialization needed - Ed25519 WebCrypto is stateless

  done = true;
}
