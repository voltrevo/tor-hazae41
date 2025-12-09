#!/bin/bash
set -e

# Start the dev server in the background with TEST_BROWSER env var
echo "Starting development server (headless)..."
TEST_BROWSER=1 npm run dev > /tmp/vite-server.log 2>&1 &
DEV_PID=$!

# Wait for the server to be ready
echo "Waiting for server to be ready..."
for i in {1..120}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Server is ready!"
    break
  fi
  if [ $i -eq 120 ]; then
    echo "Server failed to start"
    kill $DEV_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# Run the tests
echo "Running tests..."
npx tsx browser-testing/playwright.ts

# Kill the dev server
kill $DEV_PID 2>/dev/null || true
