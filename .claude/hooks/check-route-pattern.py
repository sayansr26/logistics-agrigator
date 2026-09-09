#!/usr/bin/env python3
"""PostToolUse hook: flag inline route handlers in backend route files.

CLAUDE.md calls an inline handler in a route file an AUTOMATIC FAILURE, and the
rule has four live violations - which is the signal that prose is not enforcing
it. This turns the rule into a structural check at the moment the file is
written.

Exit 2 feeds stderr back to Claude as actionable feedback; it does not undo the
edit, so a deliberate exception can still be argued for and kept.
"""
import json
import os
import re
import sys

# router.get('/x', async (req, res) => {...}) - a handler body in the route file.
INLINE = re.compile(
    r"^\s*router\.(get|post|put|patch|delete|all)\s*\([^)]*?"
    r"(async\s*)?\(\s*req\s*,\s*res",
    re.MULTILINE,
)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    path = (payload.get("tool_input", {}) or {}).get("file_path", "")
    if not path:
        sys.exit(0)

    norm = path.replace(os.sep, "/")
    if "/backend/" not in norm or "/routes/" not in norm or not norm.endswith(".js"):
        sys.exit(0)

    try:
        with open(path, encoding="utf-8") as handle:
            source = handle.read()
    except OSError:
        sys.exit(0)

    hits = [
        source[: m.start()].count("\n") + 1
        for m in INLINE.finditer(source)
    ]
    if not hits:
        sys.exit(0)

    lines = ", ".join(f"line {n}" for n in hits)
    print(
        f"Controller pattern violation in {os.path.basename(path)} ({lines}).\n"
        "CLAUDE.md: route files wire, controllers decide - an inline "
        "(req, res) handler in a route file is an AUTOMATIC FAILURE.\n"
        "Move the body into the matching controllers/*.js and reference it:\n"
        "  router.post('/bulk', validateBulk, shipmentController.bulkCreate);\n"
        "If this is one of the known pre-existing cases (api-gateway/routes/"
        "swagger.js builds routes dynamically), say so and move on.",
        file=sys.stderr,
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
