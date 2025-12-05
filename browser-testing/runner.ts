// Dynamic test runner for browser environment
// This file imports all test files that are compatible with browser environment
// Uses Vite's import.meta.glob to dynamically discover test files

interface WindowWithTests extends Window {
  __tests_completed?: boolean;
  __tests_failed?: boolean;
}

declare global {
  namespace ImportMetaGlob {
    function glob(
      pattern: string,
      options: Record<string, unknown>
    ): Record<string, () => Promise<unknown>>;
  }
}

const output = document.getElementById('output') as HTMLDivElement;

function log(message: string) {
  output.textContent += message + '\n';
  output.scrollTop = output.scrollHeight;
}

// Capture console output
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: unknown[]) => {
  const message = args.map(arg => String(arg)).join(' ');
  log(message);
  originalLog(...args);
};

console.error = (...args: unknown[]) => {
  const message = args.map(arg => String(arg)).join(' ');
  log(`ERROR: ${message}`);
  originalError(...args);
};

console.warn = (...args: unknown[]) => {
  const message = args.map(arg => String(arg)).join(' ');
  log(`WARN: ${message}`);
  originalWarn(...args);
};

async function runTests() {
  try {
    log('Starting test runner...\n');
    log('Discovering test modules...\n');

    // Use Vite's glob API to discover all test files
    // Exclude storage tests which require Node.js-specific modules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testModules = (import.meta as any).glob('../src/**/*.test.ts', {
      eager: false,
    }) as Record<string, () => Promise<unknown>>;

    // Filter out storage tests which use Node.js fs module
    const filteredModules = Object.entries(testModules).filter(
      ([path]) => !path.includes('storage')
    );

    log(`Discovered ${filteredModules.length} test modules\n`);

    let loadedCount = 0;
    const failedModules: string[] = [];

    for (const [path, loader] of filteredModules) {
      const moduleName = path
        .replace('../src/', '')
        .replace('/index.test.ts', '')
        .replace('.test.ts', '')
        .replace(/\//g, '-');

      try {
        log(`Loading: ${moduleName}...`);
        await loader();
        loadedCount++;
        log(`✓ ${moduleName}`);
      } catch (error) {
        failedModules.push(moduleName);
        log(`✗ ${moduleName} - ${error}`);
      }
    }

    log(`\n=== Test Summary ===`);
    log(
      `Successfully loaded: ${loadedCount}/${filteredModules.length} modules`
    );

    if (failedModules.length > 0) {
      log(`Failed modules: ${failedModules.join(', ')}`);
      (window as WindowWithTests).__tests_failed = true;
    }

    log(`\nBrowser tests loaded and running via phobos...`);
    log(`Note: Storage tests require Node.js and run with 'npm test' instead`);

    // Wait for any pending microtasks and macrotasks
    await new Promise(resolve => setTimeout(resolve, 3000));

    log('\n✅ Test runner completed');

    // Signal to playwright that tests are done
    (window as WindowWithTests).__tests_completed = true;
  } catch (error) {
    log(`\n❌ Test runner error: ${error}`);
    (window as WindowWithTests).__tests_completed = true;
    (window as WindowWithTests).__tests_failed = true;
  }
}

// Start the tests
runTests();
