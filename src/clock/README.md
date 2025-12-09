# Clock Module

The clock module provides abstraction over time and timers, supporting both real-world time and virtual (test-controlled) time. This is essential for:

- Testing code with time-dependent behavior
- Simulating time progression in tests
- Cross-platform compatibility (Node.js and browsers)
- Managing reference-counted timers (Node.js unref/ref pattern)

## Interfaces

### IClock

All clock implementations conform to the `IClock` interface:

```typescript
interface IClock {
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
```

## SystemClock

Uses real time from the system. Suitable for production code and browser environments.

### Features:

- `now()`: Returns `Date.now()`
- `delay()` / `delayUnref()`: Promise-based delays (recommended)
- `setTimeout()` / `setInterval()`: Traditional timer API
- `unref()` / `ref()`: Node.js-compatible (no-op in browsers)

### Example:

```typescript
import { SystemClock } from '@hazae41/echalote/clock';

const clock = new SystemClock();
console.log('Current time:', clock.now());

// Promise-based delay (recommended)
await clock.delay(1000);
console.log('1 second later');

// Background timer that won't keep process alive (Node.js only)
await clock.delayUnref(5000);
```

## VirtualClock

Simulates time progression for testing. Allows you to control when timers execute.

### Modes

#### Manual Mode (default)

You explicitly control time progression via `advanceTime()`. Useful for step-by-step testing.

```typescript
import { VirtualClock } from '@hazae41/echalote/clock';

const clock = new VirtualClock();

// Schedule some timers
let executed = false;
clock.setTimeout(() => {
  executed = true;
}, 100);

// Time hasn't advanced, timer shouldn't execute
console.log(executed); // false

// Advance time to 100ms
await clock.advanceTime(100);
console.log(executed); // true
console.log(clock.now()); // 100
```

#### Automated Mode

The clock automatically runs through scheduled timers until all "refed" timers complete. Useful for simulating complete execution flows.

```typescript
const clock = new VirtualClock({ automated: true });

let order = [];

clock.setTimeout(() => order.push(1), 30);
clock.setTimeout(() => order.push(2), 50);
clock.setTimeout(() => order.push(3), 70);

// Automatically runs timers in order
await clock.run();

console.log(order); // [1, 2, 3]
console.log(clock.now()); // 70
```

### Features

#### Ref/Unref Behavior

Matches Node.js timer behavior:

- **Refed timers** (default): Keep the process/event loop alive
- **Unrefed timers**: Don't keep the process alive (background work)

```typescript
const clock = new VirtualClock({ automated: true });

// This keeps the event loop alive
clock.delay(1000).then(() => console.log('A'));

// This doesn't keep the event loop alive
clock.delayUnref(2000).then(() => console.log('B'));

await clock.run();
console.log(clock.now()); // 1000 (stops after refed timers)
// 'A' is printed, 'B' is NOT printed
```

#### Manual Control

Stop automated execution at any time:

```typescript
const clock = new VirtualClock({ automated: true });

clock.setTimeout(() => console.log('First'), 100);
clock.setTimeout(() => {
  console.log('Stop here');
  clock.stop();
}, 200);
clock.setTimeout(() => console.log('Never executes'), 300);

await clock.run();
// Prints: "First", "Stop here"
// But NOT "Never executes"
```

## Best Practices

### For Production Code

Use `SystemClock`:

```typescript
import { SystemClock } from '@hazae41/echalote/clock';

const clock = new SystemClock();

// Prefer delay() for cleaner syntax
await clock.delay(1000);

// Use delayUnref() for background timers that shouldn't block
await clock.delayUnref(5000);
```

### For Testing

Use `VirtualClock`:

```typescript
import { VirtualClock } from '@hazae41/echalote/clock';

// Manual mode: control each step
async function testStepByStep() {
  const clock = new VirtualClock();

  let result = '';
  clock.setTimeout(() => (result += 'A'), 100);
  clock.setTimeout(() => (result += 'B'), 200);

  await clock.advanceTime(100);
  expect(result).toBe('A');

  await clock.advanceTime(100);
  expect(result).toBe('AB');
}

// Automated mode: run all at once
async function testFullExecution() {
  const clock = new VirtualClock({ automated: true });

  let result = '';
  clock.setTimeout(() => (result += 'A'), 100);
  clock.setTimeout(() => (result += 'B'), 200);

  await clock.run();
  expect(result).toBe('AB');
  expect(clock.now()).toBe(200);
}
```

### Cross-Platform Compatibility

The `unref()` / `ref()` methods work safely on both Node.js and browsers:

```typescript
// Safe to use everywhere - no-op in browsers
const timerId = clock.setTimeout(() => {}, 1000);
clock.unref(timerId); // Works in Node.js, safe no-op in browser
```

## API Reference

### IClock Methods

| Method                | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `now()`               | Get current time (milliseconds)                             |
| `delay(ms)`           | Promise that resolves after `ms` (refed)                    |
| `delayUnref(ms)`      | Promise that resolves after `ms` (unrefed)                  |
| `setTimeout(cb, ms)`  | Schedule callback after `ms`, returns timer ID              |
| `clearTimeout(id)`    | Cancel a scheduled timer                                    |
| `setInterval(cb, ms)` | Schedule repeating callback every `ms`, returns interval ID |
| `clearInterval(id)`   | Cancel a repeating interval                                 |
| `unref(id)`           | Mark timer as unrefed (doesn't keep process alive)          |
| `ref(id)`             | Mark timer as refed (keeps process alive)                   |

### VirtualClock-Only Methods

| Method            | Purpose                                                 |
| ----------------- | ------------------------------------------------------- |
| `advanceTime(ms)` | Advance virtual time by `ms` (manual mode)              |
| `run()`           | Automatically execute all refed timers (automated mode) |
| `stop()`          | Stop automated execution                                |

### VirtualClock Constructor Options

```typescript
interface VirtualClockOptions {
  automated?: boolean; // Default: false (manual mode)
  startTime?: number; // Default: 0
}
```

## Examples

See `example.ts` for complete working examples covering:

- SystemClock basic usage
- VirtualClock manual mode
- VirtualClock automated mode
- Ref/unref behavior
- Timer ordering

## Testing

Run tests with:

```bash
npm test                 # Node.js tests
npm run test:browser    # Browser tests
```

The clock module is tested in both Node.js and browser environments for cross-platform reliability.
