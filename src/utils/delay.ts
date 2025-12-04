export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function softDelay(ms: number): Promise<void> {
  return new Promise(resolve => {
    const timeout = setTimeout(resolve, ms);

    if (typeof timeout !== 'number') {
      timeout.unref();
    }
  });
}
