#!/usr/bin/env python3
"""
Autonomous Dual-Hermes Orchestrator (V8.1 Evidence-Gated)
---------------------------------------------------------
Wrapper entry point that routes to orchestrator.cli.
Supports both subcommands (status, step, run, init, reset-breaker)
and flag aliases (--status, --step, --loop, --init).
"""

import sys
from pathlib import Path

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from orchestrator.cli import main

if __name__ == "__main__":
    # Support convenient flag aliases if invoked with legacy or flag syntax
    flag_aliases = {
        "--status": ["status"],
        "-s": ["status"],
        "--step": ["step"],
        "--loop": ["run"],
        "--run": ["run"],
        "--supervised": ["supervised"],
        "--reset-breaker": ["reset-breaker"],
    }

    if len(sys.argv) > 1 and sys.argv[1] in flag_aliases:
        sys.argv[1:2] = flag_aliases[sys.argv[1]]

    main()
