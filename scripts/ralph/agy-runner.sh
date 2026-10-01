#!/bin/bash
# agy-runner.sh - Adapter for Antigravity (agy) CLI runner in Ralph autonomous loop
# Usage: ./agy-runner.sh [prompt_file]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$WORKSPACE_ROOT/.ralph/logs"
mkdir -p "$LOG_DIR"

PROMPT_FILE="${1:-$SCRIPT_DIR/prompt.md}"

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: Prompt file not found at: $PROMPT_FILE" >&2
  exit 1
fi

# Verify agy CLI is installed and available
if ! command -v agy &>/dev/null; then
  echo "Error: 'agy' CLI command not found in PATH." >&2
  echo "Please ensure Antigravity CLI is installed and available." >&2
  exit 127
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/agy_run_${TIMESTAMP}.log"

PROMPT_CONTENT=$(cat "$PROMPT_FILE")

echo "[agy-runner] Starting agy session at $(date)" | tee -a "$LOG_FILE"
echo "[agy-runner] Workspace: $WORKSPACE_ROOT" | tee -a "$LOG_FILE"
echo "[agy-runner] Log file: $LOG_FILE" | tee -a "$LOG_FILE"

# Execute agy in headless, non-interactive print mode with auto-approved permissions
# Note: agy automatically runs in the current working directory ($WORKSPACE_ROOT).
cd "$WORKSPACE_ROOT"

set +e
agy -p "$PROMPT_CONTENT" \
    --dangerously-skip-permissions \
    --output-format text \
    --print-timeout 0 \
    2>&1 | tee -a "$LOG_FILE"
EXIT_CODE=${PIPESTATUS[0]}
set -e

echo "" | tee -a "$LOG_FILE"
echo "[agy-runner] agy session finished with exit code: $EXIT_CODE at $(date)" | tee -a "$LOG_FILE"

exit "$EXIT_CODE"
