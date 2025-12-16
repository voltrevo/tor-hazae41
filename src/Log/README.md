# Log

A hierarchical logging system with timestamps relative to root logger creation.

## Usage

### Basic Logging

```typescript
import { Log } from 'tor-js';

const log = new Log();
log.debug('Starting application'); // [00.000] Starting application
log.info('Processing request'); // [00.123] Processing request
log.warn('Unusual condition detected'); // [00.456] Unusual condition detected
log.error('Something went wrong'); // [00.789] Something went wrong
```

### Child Loggers

Create child loggers with prefixed names:

```typescript
const log = new Log();

const dbLog = log.child('database');
dbLog.info('Connected'); // [00.100] [database] Connected

const queryLog = dbLog.child('query');
queryLog.debug('Executing query'); // [00.200] [database.query] Executing query

const authLog = log.child('auth');
authLog.warn('Invalid token'); // [00.300] [auth] Invalid token
```

Prefixes use dot notation for nested children: `[parent.child.grandchild]`.

### Timestamps

Timestamps are relative to root logger creation and automatically format based on elapsed time:

- **Seconds:** `[07.138]` - for times up to 59.999s
- **Minutes:** `[05:07.138]` - for times up to 59:59.999
- **Hours:** `[01:05:07.138]` - for times up to 23:59:59.999
- **Days:** `[3d 01:05:07.138]` - for times ≥ 1 day

### Custom Log Handler

Provide a custom `rawLog` function to handle logs differently:

```typescript
const logs: string[] = [];
const log = new Log({
  rawLog: (level, ...args) => {
    logs.push(`[${level.toUpperCase()}] ${args.join(' ')}`);
  },
});

log.error('Database error');
// logs[0] === "[ERROR] [00.000] Database error"
```

## API Reference

### Constructor

```typescript
new Log(params?: {
  clock?: IClock; // defaults to SystemClock
  rawLog?: (level: LogLevel, ...args: unknown[]) => void;
})
```

### Methods

- `debug(...args: unknown[]): void` - Log debug message
- `info(...args: unknown[]): void` - Log info message
- `warn(...args: unknown[]): void` - Log warn message
- `error(...args: unknown[]): void` - Log error message
- `child(name: string): Log` - Create a child logger

### Types

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```
