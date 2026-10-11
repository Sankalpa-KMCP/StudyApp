#!/usr/bin/env bash
# Dual-Hermes Orchestrator Runner (Git Bash / Linux / macOS)
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Prefer python from hermes-agent venv if available, else system python
if [ -f "$HOME/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe" ]; then
    PYTHON="$HOME/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe"
elif command -v python &>/dev/null; then
    PYTHON="python"
elif command -v python3 &>/dev/null; then
    PYTHON="python3"
else
    echo "Error: Python not found!"
    exit 1
fi

"$PYTHON" orchestrator.py "$@"
