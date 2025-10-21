// Import Buffer polyfill for browser compatibility
import { Buffer } from 'buffer';

// Import the TorClient abstraction
import { TorClient } from './src/TorClient';
import { waitForWebSocket } from './src/WebSocketDuplex';

// Make Buffer globally available
declare global {
  interface Window {
    Buffer: typeof Buffer;
    startExample: () => Promise<void>;
    clearOutput: () => void;
  }
}

window.Buffer = Buffer;

// Make Buffer globally available
declare global {
  interface Window {
    Buffer: typeof Buffer;
    startExample: () => Promise<void>;
    clearOutput: () => void;
  }
}

window.Buffer = Buffer;

// Create debug loggers
type LogType = 'info' | 'success' | 'error';

let isRunning: boolean = false;

function displayLog(message: string, type: LogType = 'info'): void {
  const output = document.getElementById('output');
  if (!output) return;

  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  output.textContent += `[${timestamp}] ${prefix} ${message}\n`;
  output.scrollTop = output.scrollHeight;

  // Also log to console
  console.log(`[${timestamp}] ${message}`);
}

function clearOutput(): void {
  const output = document.getElementById('output');
  if (output) {
    output.textContent = '';
  }
}

async function startExample(): Promise<void> {
  if (isRunning) return;

  isRunning = true;
  const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
  if (startBtn) {
    startBtn.disabled = true;
  }

  try {
    displayLog('🚀 Starting Echalote example with TorClient...');

    // Test basic WebSocket connectivity first
    displayLog('🔌 Testing basic WebSocket connectivity...');
    const testSocket = new WebSocket('wss://echo.websocket.org/');
    testSocket.binaryType = 'arraybuffer';

    try {
      await waitForWebSocket(testSocket, AbortSignal.timeout(5000));
      displayLog('✅ Basic WebSocket connectivity works', 'success');
      testSocket.close();
    } catch (error) {
      displayLog(
        `❌ Basic WebSocket test failed: ${(error as Error).message}`,
        'error'
      );
      return;
    }

    // Create TorClient with Snowflake bridge URL and logging
    displayLog('🌨️ Creating TorClient with Snowflake bridge...');
    const torClient = new TorClient({
      snowflakeUrl: 'wss://snowflake.torproject.net/',
      connectionTimeout: 15000,
      circuitTimeout: 90000,
      onLog: (message, type) => {
        displayLog(`🔧 ${message}`, type);
      },
    });

    // Make request through Tor
    displayLog('� Making HTTPS request through Tor...');
    displayLog('� This may take 30+ seconds for the initial connection...');

    const response = await torClient.fetch('https://httpbin.org/ip');
    const data = await response.json();

    displayLog(`🎉 SUCCESS! Response from httpbin.org/ip:`, 'success');
    displayLog(`📍 Your IP through Tor: ${data.origin}`, 'success');
    displayLog('✅ TorClient example completed successfully!', 'success');
  } catch (error) {
    displayLog(`❌ Example failed: ${(error as Error).message}`, 'error');
    displayLog(`Stack trace: ${(error as Error).stack}`, 'error');
  } finally {
    isRunning = false;
    if (startBtn) {
      startBtn.disabled = false;
    }
  }
}

// Make functions globally available
window.startExample = startExample;
window.clearOutput = clearOutput;

// Initial log
displayLog('🌐 Vite browser environment ready');
displayLog('📦 TorClient loaded successfully');
displayLog('� Verbose logging enabled for detailed progress tracking');
displayLog("👆 Click 'Start TorClient Example' to begin the test!");
