# tor-hazae41

Embedded Tor in the Browser based on [@hazae41/echalote](https://github.com/hazae41/echalote).

**🎯 Try the Live Demo:** https://voltrevo.github.io/tor-hazae41/

## ⚠️ Use at Your Own Risk

The underlying Tor implementation is experimental software.

## Features

- 🔄 **Persistent Circuits**: Reuses Tor circuits for better performance
- 🔃 **Automatic Updates**: Configurable circuit refresh with graceful transitions
- 🌨️ **Snowflake**: Uses Snowflake bridge to enable access over WebSockets
- 🔒 **Isolated Requests**: One-time circuits for maximum privacy
- ⚡ **Lazy Scheduling**: Smart updates only when circuits are actively used
- � **Status Monitoring**: Real-time circuit status information
- 🎯 **TypeScript**: Full TypeScript support with type definitions

## Installation

```bash
npm install tor-hazae41
```

## Demo Development

If you've cloned this repository and want to run the demo locally:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to access the interactive demo with:

- Persistent TorClient management (open/close)
- Multiple concurrent request testing
- Isolated request functionality
- Manual circuit updates
- Real-time status monitoring

## Usage

### Basic Example

```typescript
import { TorClient } from 'tor-hazae41';

const tor = new TorClient({
  snowflakeUrl: 'wss://snowflake.torproject.net/',
  onLog: console.log,
});

const response = await tor.fetch('https://httpbin.org/ip');
const data = await response.json();
console.log('Your Tor IP:', data.origin);

tor.dispose();
```

### One-time Requests (Maximum Privacy)

```typescript
import { TorClient } from 'tor-hazae41';

const response = await TorClient.fetch(
  'wss://snowflake.torproject.net/',
  'https://httpbin.org/ip'
);
const data = await response.json();
console.log('Anonymous IP:', data.origin);
```

## TorClient API

### Constructor Options

```typescript
interface TorClientOptions {
  snowflakeUrl: string; // Required: Snowflake bridge WebSocket URL
  connectionTimeout?: number; // WebSocket connection timeout (default: 15000ms)
  circuitTimeout?: number; // Circuit creation timeout (default: 90000ms)
  createCircuitEarly?: boolean; // Create circuit immediately (default: true)
  circuitUpdateInterval?: number | null; // Auto-update interval (default: 10 minutes)
  circuitUpdateAdvance?: number; // Update advance time (default: 60000ms)
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}
```

### Instance Methods

#### `fetch(url: string, options?: RequestInit): Promise<Response>`

Makes an HTTP request through the persistent Tor circuit.

```typescript
const response = await tor.fetch('https://api.example.com/data');
const json = await response.json();
```

#### `updateCircuit(deadline?: number): Promise<void>`

Manually updates the circuit with optional graceful transition.

```typescript
await tor.updateCircuit(5000); // 5-second transition
```

#### `waitForCircuit(): Promise<void>`

Waits for a circuit to be ready.

#### `getCircuitStatus()` and `getCircuitStatusString()`

Get current circuit status information.

#### `dispose(): void`

Cleanly disposes of resources.

### Static Methods

#### `TorClient.fetch(snowflakeUrl: string, url: string, options?): Promise<Response>`

Makes a one-time request with maximum isolation.

## Usage Patterns

### Persistent Client (Recommended for Multiple Requests)

```typescript
import { TorClient } from 'tor-hazae41';

const tor = new TorClient({
  snowflakeUrl: 'wss://snowflake.torproject.net/',
  circuitUpdateInterval: 10 * 60 * 1000, // 10 minutes
  onLog: console.log,
});

// Make multiple requests efficiently
const response1 = await tor.fetch('https://httpbin.org/ip');
const response2 = await tor.fetch('https://httpbin.org/headers');

tor.dispose();
```

### Isolated Requests (Maximum Privacy)

```typescript
import { TorClient } from 'tor-hazae41';

// Each request uses a completely separate circuit
const response1 = await TorClient.fetch(
  'wss://snowflake.torproject.net/',
  'https://httpbin.org/ip'
);

const response2 = await TorClient.fetch(
  'wss://snowflake.torproject.net/',
  'https://httpbin.org/ip'
);
```

## Technical Details

### Dependencies

Built on the [@hazae41/echalote](https://www.npmjs.com/package/@hazae41/echalote) Tor implementation:

- `@hazae41/echalote` - Core Tor protocol
- `@hazae41/cadenas` - TLS/cryptography
- `@hazae41/fleche` - HTTP client
- Various @hazae41 crypto packages

### Compatibility

- **Browsers**: Chrome, Firefox, Safari, Edge (requires WebAssembly)
- **TypeScript**: Full type definitions included

### Performance

- **Initial Connection**: 20-60 seconds
- **Subsequent Requests**: 1-5 seconds

## License

MIT
