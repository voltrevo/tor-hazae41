#!/bin/bash
set -e

# Run vitest in browser mode using the config
echo "Running tests in browser with vitest..."
echo ""
echo "Note: If running on a headless system without X server, use:"
echo "  xvfb-run -a bash scripts/test-browser.sh"
echo ""

# Try with xvfb-run if available, otherwise try directly
if command -v xvfb-run &> /dev/null; then
  xvfb-run -a bash -c "VITEST_BROWSER=true npx vitest run"
else
  VITEST_BROWSER=true npx vitest run
fi


