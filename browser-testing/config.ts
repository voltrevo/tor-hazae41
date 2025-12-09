#!/usr/bin/env node

import { chromium } from 'playwright';
import type { Browser } from 'playwright';

interface WindowWithTests extends Window {
  __tests_completed?: boolean;
  __tests_failed?: boolean;
}

const baseURL = 'http://localhost:5173';

async function runTests() {
  let browser: Browser | undefined;
  try {
    console.log('Launching Playwright browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Navigating to ${baseURL}/test-runner.html...`);
    await page.goto(`${baseURL}/test-runner.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Wait for tests to complete
    console.log('Waiting for tests to complete...');
    await page.waitForFunction(
      () => !!(window as WindowWithTests).__tests_completed,
      { timeout: 6 * 60 * 1000 } // 6 minutes timeout
    );

    const completed = await page.evaluate(() => ({
      completed: (window as WindowWithTests).__tests_completed,
      failed: (window as WindowWithTests).__tests_failed,
    }));

    // Get test output
    const output = await page.textContent('#output');
    console.log('\n=== Test Output ===\n');
    console.log(output);
    console.log('\n=== End Test Output ===\n');

    // Check if tests failed
    if (completed.failed) {
      console.error('Tests failed!');
      process.exit(1);
    }

    console.log('✅ Tests completed successfully!');
    await context.close();
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the tests
runTests();
