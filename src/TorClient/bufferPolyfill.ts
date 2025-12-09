import { Buffer } from 'buffer';

// Make Buffer globally available
declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

// Only set Buffer on window if we're in a browser environment
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}
