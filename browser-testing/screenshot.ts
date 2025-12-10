#!/usr/bin/env node

import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const baseURL = process.env.SCREENSHOT_URL || 'http://localhost:5173';
const outputPath = process.env.SCREENSHOT_PATH || './screenshots/demo.png';

async function takeScreenshot() {
  let browser: Browser | undefined;
  try {
    console.log(`📷 Taking screenshot of ${baseURL}`);

    mkdirSync(dirname(outputPath), { recursive: true });

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    console.log(`🌐 Navigating to ${baseURL}`);
    await page.goto(baseURL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait a moment for any dynamic content to render
    await page.waitForTimeout(1000);

    console.log(`💾 Saving screenshot to ${outputPath}`);
    await page.screenshot({ path: outputPath, fullPage: true });

    console.log(`✅ Screenshot saved: ${outputPath}`);
    await context.close();
  } catch (error) {
    console.error('❌ Error taking screenshot:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

takeScreenshot();
