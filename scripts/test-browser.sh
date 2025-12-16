#!/bin/bash
set -e

# Find an open port
find_open_port() {
  port=$((3000 + RANDOM % 1000))
  while netstat -tuln 2>/dev/null | grep -q ":$port "; do
    port=$((3000 + RANDOM % 1000))
  done
  echo $port
}

PORT=$(find_open_port)

# Start the dev server in the background with TEST_BROWSER env var
echo "Starting development server on port $PORT (headless)..."
TEST_BROWSER=1 VITE_PORT=$PORT npm run dev > /tmp/vite-server.log 2>&1 &
DEV_PID=$!

# Wait for the server to be ready
echo "Waiting for server to be ready..."
for i in {1..120}; do
  if curl -s http://localhost:$PORT > /dev/null 2>&1; then
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
TEST_BROWSER_PORT=$PORT npx tsx browser-testing/playwright.ts

# Kill the dev server
kill $DEV_PID 2>/dev/null || true
