export interface IClock {
  now(): number;
  delay(ms: number): Promise<void>;
  delayUnref(ms: number): Promise<void>;
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(timerId: unknown): void;
  setInterval(callback: () => void, interval: number): unknown;
  clearInterval(timerId: unknown): void;
  unref(timerId: unknown): void;
  ref(timerId: unknown): void;
}
