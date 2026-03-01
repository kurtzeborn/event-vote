#!/usr/bin/env bash
# Event Vote - Local Development Setup (macOS/Linux/Windows x64)
# Starts Azurite, Azure Functions, and Vite dev server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTIONS_PORT=${1:-7071}

echo ""
echo "Event Vote - Local Development Setup"
echo "====================================="
echo ""

# Check dependencies
echo "[1/6] Checking dependencies..."
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js not found"; exit 1; }
echo "   OK: Node.js $(node --version)"
command -v func >/dev/null 2>&1 || { echo "ERROR: Azure Functions Core Tools not found"; exit 1; }
echo "   OK: Azure Functions Core Tools $(func --version)"
command -v azurite >/dev/null 2>&1 || { echo "ERROR: Azurite not found. Run: npm install -g azurite"; exit 1; }
echo "   OK: Azurite installed"

# Kill existing processes
echo ""
echo "[2/6] Cleaning up..."
pkill -f azurite 2>/dev/null || true
pkill -f "func start" 2>/dev/null || true
sleep 1
echo "   OK: Cleaned up"

# Start Azurite
echo ""
echo "[3/6] Starting Azurite..."
mkdir -p "$HOME/azurite-data"
azurite --location "$HOME/azurite-data" --blobHost 0.0.0.0 --blobPort 10000 --queueHost 0.0.0.0 --queuePort 10001 --tableHost 0.0.0.0 --tablePort 10002 --skipApiVersionCheck --loose &
AZURITE_PID=$!
sleep 2
echo "   OK: Azurite started (PID: $AZURITE_PID)"

# Install & build functions
if [ ! -d "$SCRIPT_DIR/functions/node_modules" ]; then
    echo ""
    echo "   Installing functions dependencies..."
    cd "$SCRIPT_DIR/functions" && npm install
fi

echo ""
echo "[4/6] Building Azure Functions..."
cd "$SCRIPT_DIR/functions" && npm run build
echo "   OK: Build complete"

# Start Functions
echo ""
echo "[5/6] Starting Azure Functions on port $FUNCTIONS_PORT..."
cd "$SCRIPT_DIR/functions" && func start --port "$FUNCTIONS_PORT" &
FUNC_PID=$!

echo "   Waiting for functions to initialize..."
for i in $(seq 1 30); do
    if curl -s "http://localhost:${FUNCTIONS_PORT}/api/me" >/dev/null 2>&1; then
        echo "   OK: Azure Functions started"
        break
    fi
    sleep 1
    printf "."
done
echo ""

# Install web dependencies
if [ ! -d "$SCRIPT_DIR/web/node_modules" ]; then
    echo ""
    echo "   Installing web dependencies..."
    cd "$SCRIPT_DIR/web" && npm install
fi

# Start Vite
echo ""
echo "==============================================================="
echo "  Development environment is ready!"
echo ""
echo "  Web App:     http://localhost:5173"
echo "  Functions:   http://localhost:${FUNCTIONS_PORT}"
echo "  Azurite:     Ports 10000-10002"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "==============================================================="
echo ""

cleanup() {
    echo ""
    echo "Shutting down..."
    kill $FUNC_PID 2>/dev/null || true
    kill $AZURITE_PID 2>/dev/null || true
    echo "   OK: All services stopped"
}
trap cleanup EXIT

cd "$SCRIPT_DIR/web" && npm run dev
