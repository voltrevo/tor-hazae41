#!/bin/bash
set -e

# Run vitest in browser mode using headless Chromium
echo "Running tests in browser with vitest..."
VITEST_BROWSER=true npx vitest run

