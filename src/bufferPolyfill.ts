import { Buffer } from 'buffer';

// Make Buffer globally available
declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

window.Buffer = Buffer;
