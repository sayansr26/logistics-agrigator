# Update Memory Bank

Update the memory bank files after completing significant work or milestones.

## Instructions

You are an AI assistant helping to maintain the project's memory bank system. When this command is invoked, follow these steps:

### 1. Read Current Memory Bank Files

Read all memory bank files to understand current state:

- `memory-bank/activeContext.md` - Current sprint and active work
- `memory-bank/progress.md` - Overall completion status
- `memory-bank/projectbrief.md` - Project vision (rarely changes)
- `memory-bank/productContext.md` - Business context (rarely changes)
- `memory-bank/systemPatterns.md` - Architecture patterns (update when new patterns emerge)
- `memory-bank/techContext.md` - Technology stack (update when tech changes)

### 2. Analyze Recent Changes

Check what has changed since last update:

```bash
git log -5 --oneline
git diff HEAD~5 --stat
```

Review:

- Completed tasks in `backend/BACKEND_GATEWAY_TASK.md` or `frontend/FRONTEND_ARCHITECTURE_TASK.md`
- New features implemented
- Services that became production-ready
- Architecture decisions made
- Problems encountered and solutions

### 3. Update activeContext.md

Update the current sprint status:

- Mark completed tasks with ✅
- Update task progress (P0, P1, P2 counts)
- Move completed tasks to "Previous Accomplishments" section
- Update "Next Immediate Steps"
- Update "Current Day" counter
- Add any new blockers or risks discovered
- Update "Services Status Summary"

**Example Update Pattern:**

```markdown
### Active Tasks

- ✅ **GATE-001**: Remove external service ports (COMPLETED)
- 🔲 **GATE-002**: Add internal request validation (NEXT)

### Critical Path (Must Complete in Order)

1. ✅ **GATE-001**: Remove external service ports
2. 🔲 **GATE-002**: Add internal request validation (IN PROGRESS)
```

### 4. Update progress.md

Update the project progress dashboard:

- Update service completion percentages
- Update "Recent Achievements" section
- Update "Sprint Progress" with completed tasks
- Add new milestones achieved
- Update technical debt status
- Update risk register if new risks identified
- Update performance metrics if available

**Key Sections to Update:**

- Service Status Dashboard (Development %, Testing %, Documentation %)
- Sprint Progress (tasks completed count)
- Recent Achievements (add completed work)
- Upcoming Milestones (mark completed ones)

### 5. Update systemPatterns.md (if applicable)

Only update if:

- New architecture patterns were established
- New design decisions were made
- New implementation approaches were standardized
- Critical lessons learned that should be documented

**Example additions:**

- New security patterns (like service isolation)
- New middleware patterns
- New validation approaches
- Performance optimization patterns

### 6. Update techContext.md (if applicable)

Only update if:

- New dependencies added
- Technology stack changed
- Development tools changed
- Docker configuration significantly changed

### 7. Summarize Changes

After updating, provide a summary:

```markdown
## Memory Bank Updated

### Files Modified:

- activeContext.md: Updated sprint progress, marked GATE-001 complete
- progress.md: Updated service status, added security milestone

### Key Updates:

1. GATE-001 completed - service isolation implemented
2. Attack surface reduced by 80%
3. All backend services now internal-only
4. Next focus: GATE-002 internal validation

### Statistics:

- Tasks Completed: 1 (GATE-001)
- Tasks Remaining: 7 (6 P0, 2 P1)
- Sprint Progress: Day X of 14
```

## Rules

- ✅ ALWAYS read files before editing
- ✅ Be specific with dates and task IDs
- ✅ Use consistent formatting (✅ for done, 🔲 for pending, ⏳ for in-progress)
- ✅ Keep activeContext.md focused on current sprint only
- ✅ Move completed work to progress.md "Recent Achievements"
- ❌ DON'T modify projectbrief.md unless major scope changes
- ❌ DON'T modify productContext.md unless business model changes
- ❌ DON'T add vague or generic updates

## Notes

This command should be run:

- After completing major tasks (P0 tasks)
- At end of each work session
- Before switching focus areas
- After significant milestones
