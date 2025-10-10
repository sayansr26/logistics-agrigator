# Commit and Push Changes

Commit staged or modified files and push to remote repository with proper validation (no --no-verify).

## Instructions

You are an AI assistant helping to commit and push code changes following best practices. When this command is invoked, follow these steps:

### 1. Check Git Status

```bash
git status
git diff --stat
```

Analyze:

- What files are modified
- What files are staged
- What files are untracked
- Current branch name

### 2. Review Changes

Show a summary of changes:

```bash
git diff --cached --stat  # for staged files
git log -1 --stat         # last commit for context
```

### 3. Stage Appropriate Files

**Stage ONLY these file types:**

- Source code: `*.js`, `*.ts`, `*.jsx`, `*.tsx`, `*.prisma`
- Configuration: `*.json`, `*.yml`, `*.yaml`, `.env.example`
- Documentation: `*.md` (excluding backup files)
- Task files: `*TASK.md`, `*PRD*.md`

**DO NOT stage:**

- Backup files: `*.backup-*`, `*.bak`, `*.archived`
- Temporary files: `*.tmp`, `*.log`
- Node modules or build artifacts
- Environment files with secrets: `.env` (only `.env.example`)

```bash
git add <specific-files>
```

### 4. Generate Commit Message

Follow Conventional Commits format:

**Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes
- `perf`: Performance improvements
- `security`: Security improvements

**Example Commit Message:**

```markdown
feat(security): implement internal request validation (GATE-002)

Add X-Internal-Request header validation to all backend services
to ensure requests only come from API Gateway.

Changes:

- Add internal validation middleware to 8 services
- Configure INTERNAL_SECRET in all service .env files
- Update health check endpoints to allow Docker access
- Protect openapi.json endpoints with internal header check

Services Updated:

- auth-service, user-service, shipment-service, partner-service
- wallet-service, support-service, platform-service, license-service

Validation:

- Direct service calls return 403 Forbidden
- Gateway-proxied requests work correctly
- Health checks accessible from Docker

Task: GATE-002
Dependencies: GATE-001 ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 5. Create Commit (With Hooks)

**IMPORTANT**: Run commit WITHOUT --no-verify to allow pre-commit hooks:

```bash
git commit -m "$(cat <<'EOF'
<your-commit-message-here>
EOF
)"
```

**Pre-commit hooks will run:**

- ESLint for linting
- Prettier for formatting
- Commitlint for message validation
- Any custom hooks

**If hooks fail:**

- Review the errors
- Fix the issues
- Stage the fixed files
- Try committing again

### 6. Verify Commit

```bash
git log -1 --stat
git show HEAD --name-status
```

Check:

- Commit message is clear and descriptive
- All intended files are included
- No unintended files were committed

### 7. Push to Remote (With Hooks)

**IMPORTANT**: Push WITHOUT --no-verify to allow pre-push hooks:

```bash
git push origin <branch-name>
```

**Pre-push hooks will run:**

- Unit tests (`pnpm test`)
- Type checking
- Build validation
- Integration tests (if configured)

**If pre-push hooks fail:**

- Review test failures
- Fix the failing tests or code
- Commit the fixes
- Try pushing again

### 8. Confirm Success

After successful push, confirm:

```bash
git status
git log -1 --oneline
```

Provide summary:

```markdown
## ✅ Commit & Push Successful

**Commit**: <hash> - <message>

**Files Changed**: <count> files (+<insertions>, -<deletions>)

**Pre-commit Hooks**: ✅ Passed

- Prettier: Formatted X files
- ESLint: No issues
- Commitlint: Valid format

**Pre-push Hooks**: ✅ Passed

- Tests: All passed
- Type checking: No errors
- Build: Successful

**Remote**: Successfully pushed to origin/<branch>
```

## Rules

### DO:

- ✅ ALWAYS run hooks (never use --no-verify)
- ✅ Write descriptive commit messages
- ✅ Stage only relevant files
- ✅ Use conventional commit format
- ✅ Include task IDs in commit messages
- ✅ Add Co-Authored-By for Claude contributions
- ✅ Fix hook failures before forcing through

### DON'T:

- ❌ NEVER use --no-verify flag
- ❌ DON'T commit backup files
- ❌ DON'T commit .env files with secrets
- ❌ DON'T use vague commit messages like "fix" or "update"
- ❌ DON'T bypass failing tests
- ❌ DON'T commit commented-out code without explanation
- ❌ DON'T commit console.log statements (unless intentional)

## Commit Message Templates

### Feature Addition:

```
feat(scope): add new feature

Description of feature and why it's needed.

Changes:
- List of changes
- Another change

Task: TASK-ID
```

### Bug Fix:

```
fix(scope): resolve issue with X

Description of the bug and how it was fixed.

Root Cause: What caused the bug
Solution: How it was fixed

Fixes: #issue-number
```

### Security Improvement:

```
security(scope): implement security enhancement

Description of security improvement.

Security Impact:
- Before: vulnerability description
- After: how it's secured

Task: TASK-ID
```

### Refactoring:

```
refactor(scope): improve code structure

Description of refactoring and benefits.

Changes:
- Extracted X into Y
- Simplified Z logic
- Improved performance by N%

No functional changes.
```

## Error Handling

If commit or push fails:

1. **Pre-commit hook failure**: Fix linting/formatting issues
2. **Test failures**: Fix failing tests, don't skip
3. **Type errors**: Fix type issues, don't use `any`
4. **Build errors**: Resolve build issues before pushing
5. **Merge conflicts**: Resolve conflicts manually

## Notes

- This command ensures code quality by running all validation hooks
- Failed hooks indicate real issues that should be fixed
- Never bypass hooks unless absolutely necessary and documented
- All commits should be atomic (one logical change per commit)
- Commit messages should explain "why" not just "what"
