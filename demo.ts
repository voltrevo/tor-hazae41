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

function setRequestOutput(
  id: string,
  message: string,
  type: 'loading' | 'success' | 'error' | 'info' = 'info'
): void {
  const outputElement = document.getElementById(id);
  if (!outputElement) return;

  const colors = {
    loading: '#0066cc',
    success: '#28a745',
    error: '#dc3545',
    info: '#666666',
  };

  outputElement.style.color = colors[type];
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
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
  if (torClient) {
    torClient.dispose();
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
    statusElement.innerHTML = '<div><strong>TorClient closed</strong></div>';
  }

  displayLog('🛑 TorClient closed', 'info');
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
      displayLog('🔧 TorClient not open. Creating automatically...', 'info');
      await openTorClient();
      if (!torClient) {
        setRequestOutput(
          outputId,
          '❌ Failed to create TorClient automatically',
          'error'
        );
        displayLog('❌ Failed to create TorClient automatically', 'error');
        return;
      }
    }

    const urlInput = document.getElementById(`url${index}`) as HTMLInputElement;
    if (!urlInput) {
      setRequestOutput(outputId, `❌ URL input ${index} not found`, 'error');
      displayLog(`❌ URL input ${index} not found`, 'error');
      return;
    }

    const url = urlInput.value.trim();
    if (!url) {
      setRequestOutput(
        outputId,
        `❌ Please enter a URL in textbox ${index}`,
        'error'
      );
      displayLog(`❌ Please enter a URL in textbox ${index}`, 'error');
      return;
    }

    setRequestOutput(outputId, `🌐 Making request to ${url}...`, 'loading');
    displayLog(`🌐 Making request ${index} to ${url}...`);

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

    displayLog(`✅ Request ${index} completed in ${duration}ms`, 'success');

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
    displayLog(
      `❌ Request ${index} failed: ${(error as Error).message}`,
      'error'
    );
  } finally {
    // Re-enable button
    setButtonState(buttonId, false, `🌐 Make Request ${index}`);
  }
}

async function makeIsolatedRequest(): Promise<void> {
  const outputId = 'outputIsolated';
  const buttonId = 'btnIsolated';

  // Clear output and show loading
  setRequestOutput(outputId, '🔄 Loading...', 'loading');
  setButtonState(buttonId, true, '⏳ Loading...');

  try {
    const urlInput = document.getElementById('isolatedUrl') as HTMLInputElement;
    if (!urlInput) {
      setRequestOutput(outputId, '❌ Isolated URL input not found', 'error');
      displayLog('❌ Isolated URL input not found', 'error');
      return;
    }

    const url = urlInput.value.trim();
    if (!url) {
      setRequestOutput(
        outputId,
        '❌ Please enter a URL for isolated request',
        'error'
      );
      displayLog('❌ Please enter a URL for isolated request', 'error');
      return;
    }

    setRequestOutput(
      outputId,
      '🔒 Creating temporary circuit and making request...',
      'loading'
    );
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

    displayLog(`🔒 Isolated request completed in ${duration}ms`, 'success');

    // Format output based on the endpoint and data type
    let outputText = '';
    if (isJson && url.includes('/uuid') && data.uuid) {
      outputText = `✅ Success (${duration}ms)\n🔒 UUID from isolated circuit: ${data.uuid}`;
    } else if (isJson && url.includes('/ip') && data.origin) {
      outputText = `✅ Success (${duration}ms)\n🔒 IP from isolated circuit: ${data.origin}`;
    } else if (isJson) {
      outputText = `✅ Success (${duration}ms)\n🔒 JSON Response: ${JSON.stringify(data).substring(0, 200)}${JSON.stringify(data).length > 200 ? '...' : ''}`;
    } else {
      outputText = `✅ Success (${duration}ms)\n🔒 Text Response: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
    }

    setRequestOutput(outputId, outputText, 'success');
  } catch (error) {
    const errorText = `❌ Isolated request failed: ${(error as Error).message}`;
    setRequestOutput(outputId, errorText, 'error');
    displayLog(
      `❌ Isolated request failed: ${(error as Error).message}`,
      'error'
    );
  } finally {
    // Re-enable button
    setButtonState(buttonId, false, '🔒 Make Isolated Request');
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
    closeTorClient(); // This will properly reset button states
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
