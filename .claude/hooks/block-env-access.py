#!/usr/bin/env python3
"""PreToolUse hook: deny reads and edits of .env files.

This repo is public and its .env files carry JWT secrets, HMAC keys for the
Partner and Wallet APIs, DB credentials, and Razorpay / SendGrid / MSG91 /
courier tokens. They are gitignored, but nothing otherwise stops a secret being
read into context and echoed into a commit message, a doc, or a paste.

*.example files are allowed - they are the templates, and they are tracked.
"""
import json
import os
import re
import sys

# Bash commands that would print a file's contents.
READERS = r"cat|bat|head|tail|less|more|nl|strings|xxd|od|grep|rg|ag|awk|sed|cp|scp|rsync|curl\s+.*-T"


def is_protected(path: str) -> bool:
    """True for .env, .env.production, .env.uat, backend/*/.env - not *.example."""
    name = os.path.basename(path.rstrip("/"))
    if not name.startswith(".env"):
        return False
    return not name.endswith(".example")


def deny(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        # Never fail closed on a malformed payload - that would block every tool call.
        sys.exit(0)

    tool = payload.get("tool_name", "")
    args = payload.get("tool_input", {}) or {}

    if tool in ("Read", "Edit", "Write", "NotebookEdit"):
        path = args.get("file_path") or args.get("notebook_path") or ""
        if path and is_protected(path):
            deny(
                f"Blocked: {os.path.basename(path)} holds live secrets (JWT, HMAC, "
                "payment and courier credentials) in a public repo. Read the "
                "matching .env.example for the variable names instead, and ask the "
                "user for any value you actually need."
            )

    elif tool == "Bash":
        command = args.get("command", "") or ""
        # Pull out every .env-ish token and reuse is_protected(), so the Bash
        # branch and the file branch cannot disagree about what counts.
        tokens = re.findall(r"[^\s'\";|&<>]*\.env[^\s'\";|&<>]*", command)
        if re.search(rf"\b({READERS})\b", command) and any(
            is_protected(tok) for tok in tokens
        ):
            deny(
                "Blocked: this command would read a .env file, which holds live "
                "secrets in a public repo. Use the .env.example templates, or ask "
                "the user for the specific value."
            )

    sys.exit(0)


if __name__ == "__main__":
    main()
