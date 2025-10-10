# Start Next Available Task

## Pre-Execution Checklist

### 1. Memory Bank Review (MANDATORY)

First, read ALL memory bank files to understand current context:

- Read memory-bank/activeContext.md to understand current sprint and active work
- Read memory-bank/progress.md to check overall completion status
- Read memory-bank/projectbrief.md for project vision
- Read memory-bank/systemPatterns.md for architecture patterns
- Read memory-bank/techContext.md for technology decisions

### 2. Task Discovery

After understanding context, scan for available tasks:

- Read backend/BACKEND_GATEWAY_TASK.md for backend tasks
- Read frontend/FRONTEND_ARCHITECTURE_TASK.md for frontend tasks
- Use grep to find all tasks with Status: NOT_STARTED
- Check task dependencies to find unblocked tasks

### 3. Task Selection Rules

Select the appropriate task based on:

- **Priority**: P0 (critical) > P1 (high) > P2 (enhancement)
- **Dependencies**: Only select tasks with all dependencies met
- **Current Focus**: Check activeContext.md for sprint priorities
- **No Conflicts**: Ensure no other task is IN_PROGRESS

## Execution Protocol

### 4. Task Implementation

Once task is selected:

- Use TodoWrite to track the task and mark it as IN_PROGRESS
- Update the task status in the corresponding .md file (backend or frontend)
- Follow CLAUDE.md standards and patterns
- Use appropriate specialized agents:
  - backend-service-builder for backend services
  - database-manager for Prisma operations
  - frontend-developer for React/Next.js work
  - documentation-updater for docs

### 5. Project Standards

Always follow these rules from CLAUDE.md:

- Controller pattern for backend (no inline route functions)
- Use Prisma ORM only (never raw SQL)
- Include audit logging for CRUD operations
- Use shared libraries from shared/lib/
- Validate all inputs with Joi schemas
- Standard response format using shared/lib/response.js

### 6. Docker Verification (MANDATORY)

Before marking any backend task complete:

```bash
docker-compose restart [service-name]
docker logs logistics-[service-name] --tail=30
curl http://localhost:[PORT]/health | jq .
```

### 7. Task Completion Workflow (MANDATORY ORDER)

After successful implementation, follow this EXACT sequence:

**Step 1: Validation**

- Use task-verifier agent to validate completion
- Verify Docker service restart successful
- Verify all tests passing
- Verify health endpoints working

**Step 2: Documentation**

- Update task status to COMPLETED in .md file (backend/BACKEND_GATEWAY_TASK.md or frontend/FRONTEND_ARCHITECTURE_TASK.md)
- Update TodoWrite to mark as completed
- Document any issues, notes, or lessons learned in the task

**Step 3: Memory Bank Update (MANDATORY)**

- Run `/update-memory` command
- This will:
  - Update activeContext.md with completed tasks
  - Update progress.md with achievements
  - Update systemPatterns.md if new patterns emerged
  - Provide summary of changes

**Step 4: Git Commit & Push (MANDATORY)**

- Run `/commit-push` command
- This will:
  - Stage appropriate files (no backups, no .env)
  - Generate conventional commit message
  - Run pre-commit hooks (Prettier, ESLint, Commitlint)
  - Commit changes
  - Run pre-push hooks (Tests, Type checking, Build)
  - Push to remote branch
  - NEVER uses --no-verify flag

**IMPORTANT**: Steps 3 and 4 are MANDATORY and MUST be run in order. The /commit-push command ensures code quality through automated hooks.

## Critical Rules

- NEVER skip memory bank review
- NEVER start a task with unmet dependencies
- NEVER mark task complete without Docker verification
- NEVER bypass validation steps
- NEVER commit without running /commit-push (ensures all hooks run)
- NEVER skip /update-memory after completing major tasks
- ALWAYS backup critical files before changes (especially docker-compose.yml)
- ALWAYS use specialized agents for their domains
- ALWAYS run /update-memory before /commit-push on task completion

## Error Handling

If encountering blockers:

- Keep task as IN_PROGRESS
- Document the blocker in task notes
- Create new task for resolving the blocker
- Ask user for guidance if critical decision needed

## Start Execution

Begin by reading memory bank files, then identify and start the first available P0 task following all protocols above.
