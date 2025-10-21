// Import the TorClient abstraction
import { TorClient } from './src/TorClient';
import { waitForWebSocket } from './src/WebSocketDuplex';

declare global {
  interface Window {
    openTorClient: () => Promise<void>;
    closeTorClient: () => void;
    clearOutput: () => void;
    makeRequest: (index: number) => Promise<void>;
    makeIsolatedRequest: () => Promise<void>;
    triggerCircuitUpdate: () => Promise<void>;
  }
}

// Create debug loggers
type LogType = 'info' | 'success' | 'error';

let isRunning = false;
let torClient: TorClient | null = null;
let statusUpdateInterval: NodeJS.Timeout | null = null;

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

function updateStatus(): void {
  const statusElement = document.getElementById('status');
  if (!statusElement || !torClient) return;

  const statusString = torClient.getCircuitStatusString();

  statusElement.innerHTML = `
    <div><strong>Circuit Status:</strong> ${statusString}</div>
  `;
}

function clearOutput(): void {
  const output = document.getElementById('output');
  if (output) {
    output.textContent = '';
  }
}

function closeTorClient(): void {
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
  if (torClient) {
    torClient.dispose();
    torClient = null;
  }
  isRunning = false;

  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.innerHTML = '<div><strong>TorClient closed</strong></div>';
  }

  displayLog('🛑 TorClient closed', 'info');
}

async function makeRequest(index: number): Promise<void> {
  // Auto-create TorClient if not already open
  if (!torClient) {
    displayLog('🔧 TorClient not open. Creating automatically...', 'info');
    await openTorClient();
    if (!torClient) {
      displayLog('❌ Failed to create TorClient automatically', 'error');
      return;
    }
  }

  const urlInput = document.getElementById(`url${index}`) as HTMLInputElement;
  if (!urlInput) {
    displayLog(`❌ URL input ${index} not found`, 'error');
    return;
  }

  const url = urlInput.value.trim();
  if (!url) {
    displayLog(`❌ Please enter a URL in textbox ${index}`, 'error');
    return;
  }

  try {
    displayLog(`🌐 Making request ${index} to ${url}...`);

    const start = Date.now();
    const response = await torClient.fetch(url);
    const data = await response.json();
    const duration = Date.now() - start;

    displayLog(`✅ Request ${index} completed in ${duration}ms`, 'success');

    // Log specific data based on the endpoint
    if (url.includes('/ip')) {
      displayLog(`📍 IP: ${data.origin}`, 'success');
    } else if (url.includes('/user-agent')) {
      displayLog(`🔍 User-Agent: ${data['user-agent']}`, 'success');
    } else if (url.includes('/headers')) {
      displayLog(
        `📋 Headers count: ${Object.keys(data.headers).length}`,
        'success'
      );
    } else {
      displayLog(
        `📄 Response: ${JSON.stringify(data).substring(0, 100)}...`,
        'success'
      );
    }
  } catch (error) {
    displayLog(
      `❌ Request ${index} failed: ${(error as Error).message}`,
      'error'
    );
  }
}

async function makeIsolatedRequest(): Promise<void> {
  const urlInput = document.getElementById('isolatedUrl') as HTMLInputElement;
  if (!urlInput) {
    displayLog('❌ Isolated URL input not found', 'error');
    return;
  }

  const url = urlInput.value.trim();
  if (!url) {
    displayLog('❌ Please enter a URL for isolated request', 'error');
    return;
  }

  try {
    displayLog('🔒 Making isolated request with temporary circuit...');

    const start = Date.now();
    const response = await TorClient.fetch(
      'wss://snowflake.torproject.net/',
      url,
      {
        connectionTimeout: 15000,
        circuitTimeout: 90000,
        onLog: (message, type) => {
          displayLog(`🔒 Isolated: ${message}`, type);
        },
      }
    );

    const data = await response.json();
    const duration = Date.now() - start;

    displayLog(`🔒 Isolated request completed in ${duration}ms`, 'success');

    // Log specific data based on the endpoint
    if (url.includes('/uuid')) {
      displayLog(`🔒 UUID from isolated circuit: ${data.uuid}`, 'success');
    } else if (url.includes('/ip')) {
      displayLog(`🔒 IP from isolated circuit: ${data.origin}`, 'success');
    } else {
      displayLog(
        `🔒 Response: ${JSON.stringify(data).substring(0, 100)}...`,
        'success'
      );
    }
  } catch (error) {
    displayLog(
      `❌ Isolated request failed: ${(error as Error).message}`,
      'error'
    );
  }
}

async function triggerCircuitUpdate(): Promise<void> {
  if (!torClient) {
    displayLog('❌ No persistent client available for circuit update', 'error');
    return;
  }

  try {
    displayLog('🔄 Manually triggering circuit update with 10s deadline...');
    await torClient.updateCircuit(10000);
    displayLog('🔄 Circuit update completed successfully', 'success');
  } catch (error) {
    displayLog(
      `❌ Circuit update failed: ${(error as Error).message}`,
      'error'
    );
  }
}

async function openTorClient(): Promise<void> {
  if (isRunning || torClient) return;

  isRunning = true;

  // Update button states
  const openBtn = document.getElementById('openBtn') as HTMLButtonElement;
  const closeBtn = document.getElementById('closeBtn') as HTMLButtonElement;
  if (openBtn) openBtn.disabled = true;
  if (closeBtn) closeBtn.disabled = false;

  try {
    displayLog('🚀 Opening TorClient...');

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

    // Create persistent TorClient with auto-updates
    displayLog(
      '🌨️ Creating persistent TorClient with 2-minute auto-updates...'
    );
    torClient = new TorClient({
      snowflakeUrl: 'wss://snowflake.torproject.net/',
      connectionTimeout: 15000,
      circuitTimeout: 90000,
      createCircuitEarly: true,
      circuitUpdateInterval: 2 * 60_000, // 2 minutes for demo
      circuitUpdateAdvance: 30_000, // 30 seconds advance
      onLog: (message, type) => {
        displayLog(`🔧 ${message}`, type);
      },
    });

    // Start status updates
    statusUpdateInterval = setInterval(updateStatus, 500);

    displayLog('⏳ Waiting for initial circuit to be ready...');
    await torClient.waitForCircuit();

    displayLog('🎉 TorClient is ready!', 'success');
    displayLog(
      '💡 Use the URL textboxes and request buttons to make requests',
      'info'
    );
  } catch (error) {
    displayLog(
      `❌ TorClient initialization failed: ${(error as Error).message}`,
      'error'
    );
    displayLog(`Stack trace: ${(error as Error).stack}`, 'error');
    closeTorClient();
  } finally {
    if (openBtn) openBtn.disabled = false;
    if (closeBtn) closeBtn.disabled = true;
  }
}

// Make functions globally available
window.openTorClient = openTorClient;
window.closeTorClient = closeTorClient;
window.clearOutput = clearOutput;
window.makeRequest = makeRequest;
window.makeIsolatedRequest = makeIsolatedRequest;
window.triggerCircuitUpdate = triggerCircuitUpdate;

// Initial log
displayLog('🌐 Vite browser environment ready');
displayLog('📦 TorClient loaded successfully');
displayLog('🔍 Verbose logging enabled for detailed progress tracking');
displayLog("👆 Click 'Open TorClient' to begin!");
displayLog(
  '🎯 This demo shows circuit reuse, auto-updates, and isolated requests'
);
