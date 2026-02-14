---
name: manage-memory-bank
description: Maintain and update the project memory bank files with accurate, current context after implementation work. Use when tasks involve documenting project status, active priorities, architecture/tech changes, or progress updates in memory-bank/*.md.
---

# Manage Memory Bank

Keep the project memory bank accurate, concise, and internally consistent.

## Working Rules

- Read all files in `memory-bank/` before editing.
- Update only files impacted by the completed work.
- Preserve existing document intent:
  - `projectbrief.md`: stable project foundation and vision.
  - `productContext.md`: user/business problem framing.
  - `systemPatterns.md`: architecture and engineering patterns.
  - `techContext.md`: stack, tooling, and setup details.
  - `activeContext.md`: current sprint focus and immediate priorities.
  - `progress.md`: shipped work and status timeline.
- Use concrete dates (for example `February 14, 2026`) when touching "Last Updated" lines.
- Do not add speculative claims; record only verified facts from repository state or completed tasks.

## Update Workflow

1. Inspect what changed

- Review diffs, commits, and task outputs to extract factual updates.
- Group updates by type: scope/priority, architecture, implementation progress, tooling.

2. Map changes to files

- Put short-lived sprint focus into `activeContext.md`.
- Put durable completion history into `progress.md`.
- Put structural design rule changes into `systemPatterns.md`.
- Put stack/tooling/runtime updates into `techContext.md`.
- Update `projectbrief.md` or `productContext.md` only when business direction actually changed.

3. Apply edits

- Keep headings and section structure stable unless a clear reorganization is needed.
- Prefer short bullets with high signal.
- Keep percentages/status bars aligned with described completion state.

4. Consistency pass

- Ensure service names, ports, role counts, and milestone states match across files.
- Ensure `activeContext.md` priorities agree with `progress.md` shipped items.
- Remove stale "in progress" notes if work is complete.

## Output Requirements

After memory-bank updates, report:

- Which files were changed.
- Why each file needed an update.
- Any intentionally untouched files and rationale.
