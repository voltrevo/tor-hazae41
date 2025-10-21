# TorClient - Tor Browser Client

A Tor client implementation for the browser using [@hazae41/echalote](https://www.npmjs.com/package/@hazae41/echalote), featuring persistent circuit management, automatic updates, and a complete interactive demo.

## ⚠️ Use at Your Own Risk

The underlying implementation used is experimental software.

## Features

- 🔄 **Persistent Circuits**: Reuses Tor circuits for better performance
- 🔃 **Automatic Updates**: Configurable circuit refresh with graceful transitions
- 🌨️ **Snowflake**: Uses Snowflake bridge to enable browser access over WebSockets
- 🔒 **Isolated Requests**: One-time circuits for maximum privacy
- ⚡ **Lazy Scheduling**: Smart updates only when circuits are actively used
- 📊 **Status Monitoring**: Real-time circuit status and countdown timers (in demo)
- 🖥️ **Browser Native**: Runs entirely in-browser using WebAssembly
- 🎯 **Interactive Demo**: Full-featured UI for testing and exploration

## Installation

```bash
npm install
```

## Usage

### Start the Demo

```bash
npm run dev
```

Open `http://localhost:3000` to access the interactive demo with:

- Persistent TorClient management (open/close)
- Multiple concurrent request testing
- Isolated request functionality
- Manual circuit updates
- Real-time status monitoring

## TorClient API

### Constructor

```typescript
const tor = new TorClient({
  // Required
  snowflakeUrl: 'wss://snowflake.torproject.net/',

  // Optional
  connectionTimeout: 15000, // WebSocket connection timeout (ms)
  circuitTimeout: 90000, // Circuit creation timeout (ms)
  createCircuitEarly: true, // Create circuit immediately instead of waiting for a request
  circuitUpdateInterval: 10 * 60_000, // Auto-update interval (ms), null to disable
  circuitUpdateAdvance: 60_000, // Start creating new circuit before it is required
  onLog: (message, type) => {
    // log using your preferred method
  }, // Logging callback
});
```

### Instance Methods

#### `fetch(url, options?)`

Makes an HTTP request through the persistent Tor circuit.

```typescript
const response = await tor.fetch('https://httpbin.org/ip');
const data = await response.json();
```

#### `updateCircuit(deadline?)`

Manually updates the circuit with optional graceful transition period.

```typescript
// Immediate update
await tor.updateCircuit();

// 10-second graceful transition
// Uses the old circuit until the new one is ready, unless 10s elapses, then
// new requests will wait for the new circuit, even if it's not ready
await tor.updateCircuit(10_000);
```

#### `waitForCircuit()`

Waits for a circuit to be ready (useful after initialization).

```typescript
await tor.waitForCircuit();
console.log('Circuit ready for requests');
```

Note: This isn't needed - waiting is automatic, it's just here if you want to
know when the circuit is ready.

#### `getCircuitStatusString()`

Returns human-readable circuit status with countdown timers.

```typescript
const status = tor.getCircuitStatusString();
// "Ready (creating next circuit in 45s)"
```

#### `dispose()`

Cleanly disposes of the circuit and cleans up resources.

```typescript
tor.dispose();
```

### Static Methods

#### `TorClient.fetch(snowflakeUrl, url, options?)`

Makes a one-time request with a temporary circuit (maximum isolation).

```typescript
const response = await TorClient.fetch(
  'wss://snowflake.torproject.net/',
  'https://httpbin.org/uuid',
  {
    // optional
    connectionTimeout: 15000,
    circuitTimeout: 90000,
    onLog: message => console.log(`Isolated: ${message}`),
  }
);
```

## Usage Patterns

### Persistent Client (Recommended)

For applications making multiple requests:

```typescript
// Initialize with auto-updates every 2 minutes
const tor = new TorClient({
  snowflakeUrl: 'wss://snowflake.torproject.net/',
  circuitUpdateInterval: 10 * 60 * 1000,
  createCircuitEarly: true,
  onLog: console.log,
});

// Wait for initial circuit
await tor.waitForCircuit();

// Make multiple requests efficiently
const ip1 = await tor.fetch('https://httpbin.org/ip');
const ip2 = await tor.fetch('https://httpbin.org/ip'); // Reuses circuit
const headers = await tor.fetch('https://httpbin.org/headers');

// Clean up when done
tor.dispose();
```

### Isolated Requests

For maximum privacy (each request gets its own circuit):

```typescript
// Each request is completely isolated
const response1 = await TorClient.fetch(
  'wss://snowflake.torproject.net/',
  'https://httpbin.org/ip'
);

const response2 = await TorClient.fetch(
  'wss://snowflake.torproject.net/',
  'https://httpbin.org/ip'
);
// Different IP addresses, completely isolated circuits
```

### Manual Circuit Management

For applications requiring fine-grained control:

```typescript
const tor = new TorClient({
  snowflakeUrl: 'wss://snowflake.torproject.net/',
  circuitUpdateInterval: null, // Disable auto-updates
  createCircuitEarly: false, // Create on-demand
});

// Make some requests
await tor.fetch('https://httpbin.org/ip');
await tor.fetch('https://httpbin.org/headers');

// Manually refresh circuit when needed
await tor.updateCircuit(5000); // 5-second graceful transition

// Continue with fresh circuit
await tor.fetch('https://httpbin.org/user-agent');
```

## Architecture

### Circuit Lifecycle

1. **Creation**: 3-hop circuit through Tor relays via Snowflake bridge
2. **Usage**: HTTP requests routed through established circuit
3. **Updates**: Automatic or manual refresh with graceful transitions
4. **Disposal**: Clean shutdown with resource cleanup

### Smart Scheduling

- **Lazy Updates**: Only schedules replacements after first circuit use
- **Advance Creation**: New circuits created before old ones expire
- **Manual Override**: Manual updates abort scheduled updates
- **Graceful Transitions**: Configurable deadline for existing requests

### Performance Optimizations

- **Circuit Reuse**: Multiple requests share the same circuit
- **Early Creation**: Optional circuit creation during initialization
- **Background Updates**: New circuits created without blocking requests
- **Connection Pooling**: Efficient WebSocket connection management

## Technical Details

### Dependencies

Built on the [@hazae41/echalote](https://www.npmjs.com/package/@hazae41/echalote) ecosystem:

- `@hazae41/echalote` - Core Tor protocol implementation
- `@hazae41/cadenas` - TLS/cryptography
- `@hazae41/fleche` - HTTP client
- Various @hazae41 crypto packages for Tor protocol support

### Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **WebAssembly**: Required for cryptographic operations
- **WebSockets**: Required for Snowflake bridge connectivity
- **No Plugins**: Runs entirely in-browser without additional software

### Performance Characteristics

- **Initial Connection**: 30-90 seconds (varies by network conditions)
- **Subsequent Requests**: ~1-3 seconds through existing circuit
- **Circuit Updates**: Background operation, minimal request impact
- **Memory Usage**: ~10-50MB depending on circuit state

## Security Considerations

- **Circuit Isolation**: Static `TorClient.fetch()` provides maximum isolation
- **Persistent Circuits**: Balance efficiency vs anonymity for multiple requests
- **Graceful Updates**: Prevents request interruption during circuit refresh
- **No Persistent State**: All circuit data disposed on cleanup

## Demo Features

The included demo showcases:

- **Persistent Client Management**: Open/close TorClient with status monitoring
- **Multiple Request Types**: Test different endpoints simultaneously
- **Isolated Requests**: Demonstrate maximum privacy mode
- **Manual Circuit Updates**: Test graceful circuit transitions
- **Real-time Status**: Live countdown timers and circuit state
- **Individual Request Tracking**: Per-request loading states and outputs
- **Error Handling**: Comprehensive error reporting and recovery

## Development

```bash
# Start development server
npm run dev

# Lint and format code
npm run lint:fix
npm run format

# Build for production
npm run build
```
