import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  outDir: 'dist',
  target: 'es2022',
  treeshake: false,
  external: [
    '@brumewallet/wallet.wasm',
    '@hazae41/binary',
    '@hazae41/cadenas',
    '@hazae41/cascade',
    '@hazae41/chacha20poly1305',
    '@hazae41/echalote',
    '@hazae41/ed25519',
    '@hazae41/fleche',
    '@hazae41/keccak256',
    '@hazae41/ripemd160',
    '@hazae41/sha1',
    '@hazae41/x25519',
  ],
});
