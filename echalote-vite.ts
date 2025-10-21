// Import Buffer polyfill for browser compatibility
import { Buffer } from 'buffer'

// Make Buffer globally available
declare global {
  interface Window {
    Buffer: typeof Buffer
    startExample: () => Promise<void>
    clearOutput: () => void
  }
}

window.Buffer = Buffer

// Import the WebSocketDuplex from the wallet's implementation
import { WebSocketDuplex } from './src/WebSocketDuplex'

import { WalletWasm } from "@brumewallet/wallet.wasm";
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"
import { Base16 } from "@hazae41/base16";
import { Base58 } from "@hazae41/base58";
import { Base64 } from "@hazae41/base64";
import { Base64Url } from "@hazae41/base64url";
import { ChaCha20Poly1305 } from "@hazae41/chacha20poly1305";
import { Circuit, Echalote, TorClientDuplex, createSnowflakeStream } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { fetch } from "@hazae41/fleche";
import { Keccak256 } from "@hazae41/keccak256";
import { Ripemd160 } from "@hazae41/ripemd160";
import { Secp256k1 } from "@hazae41/secp256k1";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";

type LogType = 'info' | 'success' | 'error'

let isRunning: boolean = false

function log(message: string, type: LogType = 'info'): void {
  const output = document.getElementById('output')
  if (!output) return

  const timestamp = new Date().toLocaleTimeString()
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
  output.textContent += `[${timestamp}] ${prefix} ${message}\n`
  output.scrollTop = output.scrollHeight
  console.log(`[${timestamp}] ${message}`)
}

function clearOutput(): void {
  const output = document.getElementById('output')
  if (output) {
    output.textContent = ''
  }
}

async function initOrThrow() {
  await WalletWasm.initBundled()

  Sha1.set(Sha1.fromWasm(WalletWasm))

  Keccak256.set(Keccak256.fromWasm(WalletWasm))
  Ripemd160.set(Ripemd160.fromWasm(WalletWasm))

  Base16.set(Base16.fromWasm(WalletWasm))
  Base64.set(Base64.fromWasm(WalletWasm))
  Base58.set(Base58.fromWasm(WalletWasm))

  Base64Url.set(Base64Url.fromWasm(WalletWasm))

  Secp256k1.set(Secp256k1.fromWasm(WalletWasm))

  Ed25519.set(await Ed25519.fromNativeOrWasm(WalletWasm))
  X25519.set(X25519.fromWasm(WalletWasm))

  ChaCha20Poly1305.set(ChaCha20Poly1305.fromWasm(WalletWasm))
}

async function waitForWebSocket(
  socket: WebSocket,
  signal: AbortSignal = new AbortController().signal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onOpen = (): void => {
      cleanup()
      resolve()
    }
    const onError = (e: Event): void => {
      cleanup()
      reject(e)
    }
    const onClose = (e: CloseEvent): void => {
      cleanup()
      reject(e)
    }
    const onAbort = (): void => {
      cleanup()
      reject(new Error("Aborted"))
    }

    const cleanup = (): void => {
      socket.removeEventListener("open", onOpen)
      socket.removeEventListener("close", onClose)
      socket.removeEventListener("error", onError)
      signal.removeEventListener("abort", onAbort)
    }

    socket.addEventListener("open", onOpen, { passive: true })
    socket.addEventListener("close", onClose, { passive: true })
    socket.addEventListener("error", onError, { passive: true })
    signal.addEventListener("abort", onAbort, { passive: true })
  })
}

async function startExample(): Promise<void> {
  if (isRunning) return

  isRunning = true
  const startBtn = document.getElementById('startBtn') as HTMLButtonElement
  if (startBtn) {
    startBtn.disabled = true
  }

  try {
    log("🚀 Starting REAL Echalote example with Vite...")

    log('init wasm')
    await initOrThrow()
    log('wasm initialized')

    log("📚 Libraries imported successfully!")

    // Test basic WebSocket connectivity first
    log("🔌 Testing basic WebSocket connectivity...")
    const testSocket = new WebSocket("wss://echo.websocket.org/")
    testSocket.binaryType = "arraybuffer"

    try {
      await waitForWebSocket(testSocket, AbortSignal.timeout(5000))
      log("✅ Basic WebSocket connectivity works", 'success')
      testSocket.close()
    } catch (error) {
      log(`❌ Basic WebSocket test failed: ${(error as Error).message}`, 'error')
      return
    }

    log("🌨️ Connecting to Snowflake bridge...")

    // Create WebSocket connection to Snowflake bridge
    const socket = new WebSocket("wss://snowflake.torproject.net/")
    socket.binaryType = "arraybuffer"

    // Wait for WebSocket to open with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    try {
      await waitForWebSocket(socket, controller.signal)
      clearTimeout(timeoutId)
      log("✅ Connected to Snowflake bridge!", 'success')

      // Add WebSocket debugging
      socket.addEventListener('message', (event: MessageEvent) => {
        const size = event.data.byteLength || event.data.length
        log(`📨 WebSocket received ${size} bytes`)
      })

      socket.addEventListener('error', (error: Event) => {
        log(`🔴 WebSocket error: ${error}`, 'error')
      })

      socket.addEventListener('close', (event: CloseEvent) => {
        log(`🔴 WebSocket closed: code=${event.code}, reason=${event.reason}`, 'error')
      })

    } catch (error) {
      clearTimeout(timeoutId)
      log(`❌ Failed to connect to Snowflake bridge: ${(error as Error).message}`, 'error')
      return
    }

    // Create duplex stream from WebSocket
    log("🔧 Creating WebSocketDuplex wrapper...")
    const stream = new WebSocketDuplex(socket, { shouldCloseOnError: true, shouldCloseOnClose: true })

    // Create Snowflake stream and Tor client
    log("🌨️ Creating Snowflake stream...")
    const tcp = createSnowflakeStream(stream)
    const tor = new TorClientDuplex()

    // Connect streams with better error handling
    log("🔗 Connecting streams...")

    tcp.outer.readable.pipeTo(tor.inner.writable).catch((error: Error) => {
      log(`⚠️ TCP -> Tor stream error: ${error.message}`, 'error')
    })

    tor.inner.readable.pipeTo(tcp.outer.writable).catch((error: Error) => {
      log(`⚠️ Tor -> TCP stream error: ${error.message}`, 'error')
    })

    // Add event listeners for debugging
    tor.events.on("error", (error: unknown) => {
      log(`🔴 Tor client error: ${error}`, 'error')
    })

    tor.events.on("close", (reason: unknown) => {
      log(`🔴 Tor client closed: ${reason}`, 'error')
    })

    // Wait for Tor to be ready with more detailed logging
    log("⏳ Waiting for Tor to be ready (this may take 30+ seconds)...")
    log("📝 This step performs the Tor handshake with the Snowflake bridge...")

    try {
      await tor.waitOrThrow(AbortSignal.timeout(90000)) // Increased to 90 seconds
      log("✅ Tor client ready!", 'success')
    } catch (error) {
      log(`❌ Tor handshake failed: ${(error as Error).message}`, 'error')
      log(`🔍 This could indicate:`, 'error')
      log(`   • Snowflake bridge connection issues`, 'error')
      log(`   • Tor protocol handshake problems`, 'error')
      log(`   • Network interference or timeouts`, 'error')
      throw error
    }

    // Create circuit
    log("🔗 Creating circuit...")
    const circuit: Circuit = await tor.createOrThrow()
    log("✅ Circuit created!", 'success')

    // Fetch consensus
    log("📋 Fetching consensus...")
    const consensus = await Echalote.Consensus.fetchOrThrow(circuit)
    log(`✅ Consensus fetched with ${consensus.microdescs.length} microdescs!`, 'success')

    // Filter relays
    log("🔍 Filtering relays...")
    const middles = consensus.microdescs.filter((it: any) => true
      && it.flags.includes("Fast")
      && it.flags.includes("Stable")
      && it.flags.includes("V2Dir"))

    const exits = consensus.microdescs.filter((it: any) => true
      && it.flags.includes("Fast")
      && it.flags.includes("Stable")
      && it.flags.includes("Exit")
      && !it.flags.includes("BadExit"))

    log(`📊 Found ${middles.length} middle relays and ${exits.length} exit relays`)

    if (middles.length === 0 || exits.length === 0) {
      log("❌ Not enough suitable relays found", 'error')
      return
    }

    // Select middle relay and extend circuit
    log("🔀 Extending circuit through middle relay...")
    const middle = middles[Math.floor(Math.random() * middles.length)]
    const middle2 = await Echalote.Consensus.Microdesc.fetchOrThrow(circuit, middle)
    await circuit.extendOrThrow(middle2, AbortSignal.timeout(10000))
    log("✅ Extended through middle relay!", 'success')

    // Select exit relay and extend circuit
    log("🚪 Extending circuit through exit relay...")
    const exit = exits[Math.floor(Math.random() * exits.length)]
    const exit2 = await Echalote.Consensus.Microdesc.fetchOrThrow(circuit, exit)
    await circuit.extendOrThrow(exit2, AbortSignal.timeout(10000))
    log("✅ Extended through exit relay!", 'success')

    // Open TCP connection through Tor
    log("🌐 Opening connection to target...")
    const ttcp = await circuit.openOrThrow("httpbin.org", 443)

    // Create TLS connection
    log("🔒 Setting up TLS connection...")
    const ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384, Ciphers.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384]
    const ttls = new TlsClientDuplex({ host_name: "httpbin.org", ciphers })

    // Connect TLS streams
    ttcp.outer.readable.pipeTo(ttls.inner.writable).catch(() => { })
    ttls.inner.readable.pipeTo(ttcp.outer.writable).catch(() => { })

    log("📡 Making HTTPS request through Tor...")
    // Make HTTPS request through Tor
    const response = await fetch("https://httpbin.org/ip", { stream: ttls.outer })
    const data = await response.json()

    log(`🎉 SUCCESS! Response from httpbin.org/ip:`, 'success')
    log(`📍 Your IP through Tor: ${data.origin}`, 'success')
    log("✅ Full Echalote example completed successfully!", 'success')

    // Clean up
    circuit[Symbol.dispose]()

  } catch (error) {
    log(`❌ Example failed: ${(error as Error).message}`, 'error')
    log(`Stack trace: ${(error as Error).stack}`, 'error')
  } finally {
    isRunning = false
    if (startBtn) {
      startBtn.disabled = false
    }
  }
}

// Make functions globally available
window.startExample = startExample
window.clearOutput = clearOutput

// Initial log
log("🌐 Vite browser environment ready")
log("📦 Echalote libraries loaded successfully")
log("👆 Click 'Start Full Echalote Example' to begin the real test!")