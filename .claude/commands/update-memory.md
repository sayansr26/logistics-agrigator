---
description: Update the project memory bank (Serena memories) to reflect the work just completed
---

Update the project memory bank to reflect the task just completed.

The memory bank lives in Serena memories (`.serena/memories/`), not in a
top-level `memory-bank/` directory — that path was migrated away.

1. Read the entries you are about to change, so the update is an edit rather
   than a rewrite:
   - `mcp__serena__read_memory("activeContext")` — current focus & priorities
   - `mcp__serena__read_memory("progress")` — development status & changelog
   - and any of `projectbrief`, `productContext`, `systemPatterns`,
     `techContext` the work actually touched.
2. Write the updates back with `mcp__serena__edit_memory` (targeted change) or
   `mcp__serena__write_memory` (full replacement). Editing the file under
   `.serena/memories/` directly is equivalent — pick whichever is cleaner.
3. Which entry gets what:
   - `activeContext` — what is in flight now, next task, blockers. Replace the
     stale focus; do not append a second "current" section.
   - `progress` — append what was completed, with the date and service.
   - `systemPatterns` — only if a new architectural pattern was established.
   - `techContext` — only if the stack, tooling, or ports changed.
   - `projectbrief` / `productContext` — only if scope or business context moved.
4. Keep service status tables in `CLAUDE.md` and `progress` consistent with
   each other if completion percentages changed.

If the Serena MCP server is unavailable, read and edit the files under
`.serena/memories/*.md` directly — same content, same names.

Do not run any git command; report what changed and leave committing to the user.
