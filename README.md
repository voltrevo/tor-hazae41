# Echalote Tor Client Example

This is a minimal standalone example demonstrating how to use the [@hazae41/echalote](https://github.com/hazae41/echalote) library to create a Tor client in the browser.

## What This Example Does

1. **Connects to Snowflake**: Uses Tor's Snowflake pluggable transport to bypass censorship
2. **Establishes Tor Circuit**: Creates a 3-hop circuit through Tor relays
3. **Makes HTTPS Request**: Demonstrates making a secure request through the Tor network
4. **Shows Tor IP**: Displays your IP address as seen through the Tor network

## Features

- 🌨️ **Snowflake Bridge Support**: Connects through Tor's anti-censorship technology
- 🔒 **Full TLS Support**: End-to-end encrypted connections
- 🔗 **Circuit Building**: Builds proper 3-hop Tor circuits
- 📡 **Real HTTP Requests**: Makes actual requests through the Tor network
- 🖥️ **Browser Compatible**: Runs entirely in the browser using WebAssembly

## Dependencies

This example only requires the essential @hazae41 packages:

- `@hazae41/echalote` - Core Tor client implementation
- `@hazae41/cadenas` - TLS implementation
- `@hazae41/fleche` - HTTP client
- `@brumewallet/wallet.wasm` - WebAssembly cryptography
- Various @hazae41 crypto packages (base64, ed25519, etc.)

## Installation

```bash
npm install
```

## Usage

```bash
npm run dev
```

Then open your browser to `http://localhost:3000` and click "Start Full Echalote Example".

## How It Works

1. **WebSocket Connection**: Connects to `wss://snowflake.torproject.net/`
2. **Tor Handshake**: Performs the Tor protocol handshake
3. **Circuit Building**: Extends circuit through middle and exit relays
4. **TLS Connection**: Establishes secure connection to target server
5. **HTTP Request**: Makes request to `httpbin.org/ip` to show Tor IP

## Performance Notes

- Initial connection can take 30-90 seconds
- Subsequent requests through the same circuit are faster
- Network conditions affect connection time

## Extracted From

This example was extracted from the [Brume Wallet](https://github.com/voltrevo/brume-wallet) project and contains only the minimal dependencies needed to run the Echalote Tor client.

## Original Dependencies

The original project contains many additional features. This extraction includes only:

- `src/libs/streams/websocket.ts` - WebSocket duplex stream wrapper
- `echalote-vite.ts` - Main Tor client example
- Essential package dependencies for Tor functionality
