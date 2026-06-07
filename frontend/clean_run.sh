#!/bin/bash

# Exit on error
set -e

# Add log level selector with default to INFO
LOG_LEVEL=${1:-info}

case $LOG_LEVEL in
    info|debug|trace)
        export RUST_LOG=$LOG_LEVEL
        ;;
    *)
        echo "Invalid log level: $LOG_LEVEL. Valid options: info, debug, trace"
        exit 1
        ;;
esac

# Clean up previous builds
echo "Cleaning up previous builds..."
#rm -rf target/
#rm -rf src-tauri/target
#rm -rf src-tauri/gen

# Clean up npm, pnp and next
echo "Cleaning up npm, pnp and next..."
rm -rf node_modules
rm -rf .next
rm -rf .pnp.cjs
rm -rf out

echo "Installing dependencies..."
pnpm install

echo "Building llama-helper sidecar..."
TAURI_GPU_FEATURE=${TAURI_GPU_FEATURE:-$(node scripts/auto-detect-gpu.js)}
LLAMA_FEATURES=""
if [ -n "$TAURI_GPU_FEATURE" ] && [ "$TAURI_GPU_FEATURE" != "none" ]; then
    LLAMA_FEATURE="$TAURI_GPU_FEATURE"
    if [ "$LLAMA_FEATURE" = "coreml" ]; then
        LLAMA_FEATURE="metal"
    fi
    LLAMA_FEATURES="--features $LLAMA_FEATURE"
fi
cargo build -p llama-helper $LLAMA_FEATURES
TARGET_TRIPLE=$(rustc -vV | grep "host:" | awk '{print $2}')
mkdir -p src-tauri/binaries
cp "../target/debug/llama-helper" "src-tauri/binaries/llama-helper-$TARGET_TRIPLE"

echo "Starting Tauri dev (Next.js dev server starts automatically)..."
pnpm run tauri:dev
sleep

