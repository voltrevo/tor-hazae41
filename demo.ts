// Import the TorClient abstraction
import { TorClient } from './src/TorClient';
import { waitForWebSocket } from './src/WebSocketDuplex';

declare global {
  interface Window {
    startDemo: () => Promise<void>;
    clearOutput: () => void;
    stopDemo: () => void;
    makeIsolatedRequest: () => Promise<void>;
    makeConcurrentRequests: () => Promise<void>;
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

  const status = torClient.getCircuitStatus();
  const statusString = torClient.getStatusString();

  statusElement.innerHTML = `
    <div><strong>Circuit Status:</strong> ${statusString}</div>
    <div><strong>Has Circuit:</strong> ${status.hasCircuit ? '✅' : '❌'}</div>
    <div><strong>Is Creating:</strong> ${status.isCreating ? '🔄' : '❌'}</div>
    <div><strong>Is Updating:</strong> ${status.isUpdating ? '🔄' : '❌'}</div>
    ${status.isUpdating ? `<div><strong>Time to Deadline:</strong> ${Math.ceil(status.timeToDeadline / 1000)}s</div>` : ''}
    <div><strong>Auto-Update Active:</strong> ${status.updateActive ? '✅' : '❌'}</div>
    ${status.nextUpdateIn !== null ? `<div><strong>Update Interval:</strong> ${Math.ceil(status.nextUpdateIn / 1000)}s</div>` : ''}
  `;
}

function clearOutput(): void {
  const output = document.getElementById('output');
  if (output) {
    output.textContent = '';
  }
}

function stopDemo(): void {
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
    statusElement.innerHTML = '<div><strong>Demo stopped</strong></div>';
  }

  displayLog('🛑 Demo stopped', 'info');
}

async function makeIsolatedRequest(): Promise<void> {
  try {
    displayLog('🔒 Making isolated request with temporary circuit...');

    const start = Date.now();
    const response = await TorClient.fetch(
      'wss://snowflake.torproject.net/',
      'https://httpbin.org/uuid',
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
    displayLog(`🔒 UUID from isolated circuit: ${data.uuid}`, 'success');
  } catch (error) {
    displayLog(
      `❌ Isolated request failed: ${(error as Error).message}`,
      'error'
    );
  }
}

async function makeConcurrentRequests(): Promise<void> {
  if (!torClient) {
    displayLog(
      '❌ No persistent client available for concurrent requests',
      'error'
    );
    return;
  }

  try {
    displayLog('🔄 Making 3 concurrent requests through persistent circuit...');

    const start = Date.now();
    const requests = [
      torClient.fetch('https://httpbin.org/ip'),
      torClient.fetch('https://httpbin.org/user-agent'),
      torClient.fetch('https://httpbin.org/headers'),
    ];

    const responses = await Promise.all(requests);
    const results = await Promise.all(responses.map(r => r.json()));
    const duration = Date.now() - start;

    displayLog(
      `🔄 All concurrent requests completed in ${duration}ms`,
      'success'
    );
    displayLog(`🔄 IP: ${results[0].origin}`, 'success');
    displayLog(`🔄 User-Agent: ${results[1]['user-agent']}`, 'success');
    displayLog(
      `🔄 Headers count: ${Object.keys(results[2].headers).length}`,
      'success'
    );
  } catch (error) {
    displayLog(
      `❌ Concurrent requests failed: ${(error as Error).message}`,
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

async function startDemo(): Promise<void> {
  if (isRunning) return;

  isRunning = true;

  // Update button states
  const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
  if (startBtn) startBtn.disabled = true;
  if (stopBtn) stopBtn.disabled = false;

  try {
    displayLog('🚀 Starting comprehensive TorClient demo...');

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

    displayLog('🎉 Persistent circuit is ready!', 'success');
    displayLog(
      '💡 Now you can use the buttons to test different features:',
      'info'
    );
    displayLog('  • Make Isolated Request - Creates temporary circuit', 'info');
    displayLog(
      '  • Make Concurrent Requests - Uses persistent circuit',
      'info'
    );
    displayLog('  • Trigger Circuit Update - Forces circuit refresh', 'info');

    // Make an initial request to demonstrate the persistent circuit
    displayLog('🌐 Making initial request through persistent circuit...');
    const response = await torClient.fetch('https://httpbin.org/ip');
    const data = await response.json();
    displayLog(
      `📍 Your IP through persistent Tor circuit: ${data.origin}`,
      'success'
    );
  } catch (error) {
    displayLog(
      `❌ Demo initialization failed: ${(error as Error).message}`,
      'error'
    );
    displayLog(`Stack trace: ${(error as Error).stack}`, 'error');
    stopDemo();
  } finally {
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
  }
}

// Make functions globally available
window.startDemo = startDemo;
window.stopDemo = stopDemo;
window.clearOutput = clearOutput;
window.makeIsolatedRequest = makeIsolatedRequest;
window.makeConcurrentRequests = makeConcurrentRequests;
window.triggerCircuitUpdate = triggerCircuitUpdate;

// Initial log
displayLog('🌐 Vite browser environment ready');
displayLog('📦 TorClient loaded successfully');
displayLog('🔍 Verbose logging enabled for detailed progress tracking');
displayLog("👆 Click 'Start Demo' to begin the comprehensive test!");
displayLog(
  '🎯 This demo will show circuit reuse, auto-updates, and isolated requests'
);
