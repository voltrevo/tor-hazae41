// Polyfill Buffer for browser environment
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

// Import the TorClient abstraction
import { TorClient } from './src/TorClient';
import { CircuitStatus } from './src/TorClient/CircuitManager';
import { waitForWebSocket } from './src/TorClient/WebSocketDuplex.js';
import { Log } from './src/Log/index.js';
import { SystemClock } from './src/clock';

/**
 * CIRCUIT BUFFER DEMONSTRATION
 *
 * This demo showcases the CircuitManager's circuit buffer capability:
 *
 * - Shared Tor Connection: The TorClient maintains ONE persistent connection to the Tor network
 *   (via Snowflake bridge). This is the expensive part and is reused across all requests.
 *
 * - Circuit Buffer: When circuitBuffer > 0, the CircuitManager creates circuits proactively:
 *   - Creates N circuits in parallel in the background
 *   - Adds them to a buffer as they complete (not in start order)
 *   - Allocates from oldest buffered circuit when a request needs one
 *
 * - Per-Host Circuits: Each unique hostname gets allocated a buffered circuit:
 *   - Request to httpbin.org uses Buffered Circuit A (exit relay X)
 *   - Request to example.com uses Buffered Circuit B (exit relay Y)
 *   - Request to httpbin.org again reuses allocated Circuit A
 *
 * - Smart Retry Logic: Buffer creation uses exponential backoff (5s → 60s → reset to 5s on success):
 *   - Prevents tight retry loops if circuit creation is failing
 *   - Gradually backs off: 5s → 5.5s → 6s → ... up to 60s
 *   - Resets to 5s on first successful circuit creation
 *
 * - Dead Buffered Circuit Replacement: Buffered circuits idle for 5 minutes are auto-replaced:
 *   - Keeps buffer fresh with circuits that have recently succeeded
 *   - Automatically maintains configured buffer size
 *
 * Try these configurations:
 *   - circuitBuffer: 0  (default, no pre-creation, on-demand)
 *   - circuitBuffer: 3  (maintain 3 ready circuits)
 *   - circuitBuffer: 5  (maintain 5 ready circuits)
 */
declare global {
  interface Window {
    openTorClient: () => Promise<void>;
    closeTorClient: () => void;
    clearOutput: () => void;
    makeRequest: (index: number) => Promise<void>;
    triggerCircuitUpdate: () => Promise<void>;
  }
}

let isRunning = false;
let torClient: TorClient | null = null;
let statusUpdateTimer: unknown | null = null;
const clock = new SystemClock();

// Root logger that outputs to both DOM and console
const log = new Log({
  rawLog: (level, ...args) => {
    const output = document.getElementById('output');
    if (output) {
      const timestamp = new Date().toLocaleTimeString();
      const message = args.join(' ');
      output.textContent += `[${timestamp}] ${message}\n`;
      output.scrollTop = output.scrollHeight;
    }
    // Also log to console
    const consoleMethod =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.log;
    consoleMethod(...args);
  },
});

function updateStatus(): void {
  const statusElement = document.getElementById('status');
  const circuitStatusElement = document.getElementById('circuitStatus');
  if (!statusElement || !torClient) return;

  const statusData = torClient.getCircuitStatus();
  const statusStrings = torClient.getCircuitStatusString();

  let statusText = '✅ Connected';
  let circuitHTML = '';

  if (typeof statusData === 'object' && statusData !== null) {
    if ('idleTime' in statusData) {
      // Single circuit in initialization state
      statusText = '⏳ Initializing...';
      circuitHTML = '<div>Initializing circuits...</div>';
    } else {
      // Multiple circuits - use the status strings
      if (typeof statusStrings === 'object' && statusStrings !== null) {
        const firstStatusStr = Object.values(statusStrings)[0];
        statusText = `✅ Connected`;

        // Build circuit status details using the proper status strings
        circuitHTML = '<div>';
        for (const [host, statusStr] of Object.entries(statusStrings)) {
          circuitHTML += `<div><strong>${host}</strong>: ${statusStr}</div>`;
        }
        circuitHTML += '</div>';
      } else {
        circuitHTML = '<div>No circuits active</div>';
      }
    }
  } else {
    circuitHTML = '<div>No circuits active</div>';
  }

  statusElement.textContent = statusText;
  if (circuitStatusElement) {
    circuitStatusElement.innerHTML = circuitHTML;
  }
}

function clearOutput(): void {
  const output = document.getElementById('output');
  if (output) {
    output.textContent = '';
  }
}

function setRequestOutput(
  id: string,
  message: string,
  type: 'loading' | 'success' | 'error' | 'info' = 'info'
): void {
  const outputElement = document.getElementById(id);
  if (!outputElement) return;

  // Remove existing classes
  outputElement.classList.remove('loading', 'error', 'success');

  // Add appropriate class
  if (type !== 'info') {
    outputElement.classList.add(type);
  }

  outputElement.textContent = message;
}

function setButtonState(
  buttonId: string,
  disabled: boolean,
  text?: string
): void {
  const button = document.getElementById(buttonId) as HTMLButtonElement;
  if (!button) return;

  button.disabled = disabled;
  if (text) {
    button.textContent = text;
  }
}

function closeTorClient(): void {
  if (statusUpdateTimer) {
    clock.clearInterval(statusUpdateTimer);
    statusUpdateTimer = null;
  }
  if (torClient) {
    torClient.close();
    torClient = null;
  }
  isRunning = false;

  // Update button states
  const openBtn = document.getElementById('openBtn') as HTMLButtonElement;
  const closeBtn = document.getElementById('closeBtn') as HTMLButtonElement;
  if (openBtn) openBtn.disabled = false;
  if (closeBtn) closeBtn.disabled = true;

  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = '🛑 Closed';
  }

  log.info('🛑 TorClient closed');
}

async function makeRequest(index: number): Promise<void> {
  const outputId = `output${index}`;
  const buttonId = `btn${index}`;

  // Clear output and show loading
  setRequestOutput(outputId, '🔄 Loading...', 'loading');
  setButtonState(buttonId, true, '⏳ Loading...');

  try {
    // Auto-create TorClient if not already open
    if (!torClient) {
      setRequestOutput(
        outputId,
        '🔧 Creating TorClient automatically...',
        'loading'
      );
      log.info('🔧 TorClient not open. Creating automatically...');
      await openTorClient();
      if (!torClient) {
        setRequestOutput(
          outputId,
          '❌ Failed to create TorClient automatically',
          'error'
        );
        log.error('❌ Failed to create TorClient automatically');
        return;
      }
    }

    const urlInput = document.getElementById(`url${index}`) as HTMLInputElement;
    if (!urlInput) {
      setRequestOutput(outputId, `❌ URL input ${index} not found`, 'error');
      log.error(`❌ URL input ${index} not found`);
      return;
    }

    const url = urlInput.value.trim();
    if (!url) {
      setRequestOutput(
        outputId,
        `❌ Please enter a URL in textbox ${index}`,
        'error'
      );
      log.error(`❌ Please enter a URL in textbox ${index}`);
      return;
    }

    setRequestOutput(outputId, `🌐 Making request to ${url}...`, 'loading');
    log.info(`🌐 Making request ${index} to ${url}...`);

    const start = Date.now();
    const response = await torClient.fetch(url);
    const text = await response.text();
    const duration = Date.now() - start;

    // Try to parse as JSON, fallback to text
    let data;
    let isJson = false;
    try {
      data = JSON.parse(text);
      isJson = true;
    } catch {
      data = text;
      isJson = false;
    }

    log.info(`✅ Request ${index} completed in ${duration}ms`);

    // Format output based on the endpoint and data type
    let outputText = '';
    if (isJson && url.includes('/ip') && data.origin) {
      outputText = `✅ Success (${duration}ms)\n📍 IP: ${data.origin}`;
    } else if (isJson && url.includes('/user-agent') && data['user-agent']) {
      outputText = `✅ Success (${duration}ms)\n🔍 User-Agent: ${data['user-agent']}`;
    } else if (isJson && url.includes('/headers') && data.headers) {
      outputText = `✅ Success (${duration}ms)\n📋 Headers count: ${Object.keys(data.headers).length}`;
    } else if (isJson) {
      outputText = `✅ Success (${duration}ms)\n📄 JSON Response: ${JSON.stringify(data).substring(0, 200)}${JSON.stringify(data).length > 200 ? '...' : ''}`;
    } else {
      outputText = `✅ Success (${duration}ms)\n📄 Text Response: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
    }

    setRequestOutput(outputId, outputText, 'success');
  } catch (error) {
    const errorText = `❌ Request failed: ${(error as Error).message}`;
    setRequestOutput(outputId, errorText, 'error');
    log.error(`❌ Request ${index} failed: ${(error as Error).message}`);
  } finally {
    // Re-enable button
    setButtonState(buttonId, false, `🌐 Make Request ${index}`);
  }
}

async function triggerCircuitUpdate(): Promise<void> {
  if (!torClient) {
    log.error('❌ No persistent client available for circuit update');
    return;
  }

  try {
    log.info('🔄 Manually triggering circuit update with 10s deadline...');
    await torClient.updateCircuit(10000);
    log.info('🔄 Circuit update completed successfully');
  } catch (error) {
    log.error(`❌ Circuit update failed: ${(error as Error).message}`);
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
    log.info('🚀 Opening TorClient...');

    // Get Snowflake URL from input field
    const snowflakeUrlInput = document.getElementById(
      'snowflakeUrl'
    ) as HTMLInputElement;
    const snowflakeUrl =
      snowflakeUrlInput?.value?.trim() || 'wss://snowflake.torproject.net/';

    log.info(`🌨️ Using Snowflake URL: ${snowflakeUrl}`);

    // Test basic WebSocket connectivity first
    log.info('🔌 Testing basic WebSocket connectivity...');
    const testSocket = new WebSocket('wss://echo.websocket.org/');
    testSocket.binaryType = 'arraybuffer';

    try {
      await waitForWebSocket(testSocket, AbortSignal.timeout(5000));
      log.info('✅ Basic WebSocket connectivity works');
      testSocket.close();
    } catch (error) {
      log.error(`❌ Basic WebSocket test failed: ${(error as Error).message}`);
      return;
    }

    // Create persistent TorClient with circuit buffer
    log.info(
      '🌨️ Creating persistent TorClient with circuit buffer (3 circuits)...'
    );

    torClient = new TorClient({
      snowflakeUrl: snowflakeUrl,
      connectionTimeout: 15000,
      circuitTimeout: 90000,
      circuitBuffer: 2, // Maintain 2 circuits in buffer
      circuitUpdateInterval: 2 * 60_000, // 2 minutes for demo
      circuitUpdateAdvance: 30_000, // 30 seconds advance
      log: log.child('tor'),
    });

    // Start status updates
    statusUpdateTimer = clock.setInterval(updateStatus, 500);

    log.info('⏳ Waiting for buffered circuits to initialize...');
    await torClient.waitForCircuit();

    log.info('🎉 TorClient is ready!');
    log.info('💡 Use the URL textboxes and request buttons to make requests');
    log.info('📊 Circuit buffer will maintain 3 circuits ready to go');
  } catch (error) {
    log.error(
      `❌ TorClient initialization failed: ${(error as Error).message}`
    );
    log.error(`Stack trace: ${(error as Error).stack}`);
    closeTorClient(); // This will properly reset button states
  }
}

// Make functions globally available
window.openTorClient = openTorClient;
window.closeTorClient = closeTorClient;
window.clearOutput = clearOutput;
window.makeRequest = makeRequest;
window.triggerCircuitUpdate = triggerCircuitUpdate;

// Initial log
log.info('🌐 Vite browser environment ready');
log.info('📦 TorClient loaded successfully');
log.info('🔍 Verbose logging enabled for detailed progress tracking');
log.info("👆 Click 'Open Connection' to begin!");
log.info('🎯 This demo shows circuit reuse and auto-updates');
