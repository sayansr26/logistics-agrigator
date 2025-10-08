# Cursor Rules Auto-Apply Configuration

## ✅ Status: ALL RULES AUTO-APPLY ENABLED

All 6 rule files have been configured with `alwaysApply: true` and enhanced glob patterns to ensure automatic activation in every chat session.

## 📋 Rule Files Overview

| Rule File                    | Auto-Apply | Key Enforcement                                |
| ---------------------------- | ---------- | ---------------------------------------------- |
| **backend.mdc**              | ✅ Yes     | Controller patterns, Prisma ORM, audit logging |
| **shared-libraries.mdc**     | ✅ Yes     | Import paths (`../shared/lib/*`)               |
| **task-verification.mdc**    | ✅ Yes     | Docker testing before task completion          |
| **rule-enforcement.mdc**     | ✅ Yes     | Complete rule compliance workflow              |
| **development-workflow.mdc** | ✅ Yes     | PNPM commands, conventional commits            |
| **frontend.mdc**             | ✅ Yes     | Next.js 14 patterns, TypeScript                |

## 🎯 When Rules Auto-Trigger

### Backend Development

```
File: backend/*/controllers/*.js
Auto-triggers: backend.mdc, shared-libraries.mdc, task-verification.mdc, rule-enforcement.mdc

File: backend/*/routes/*.js
Auto-triggers: backend.mdc, shared-libraries.mdc, task-verification.mdc, rule-enforcement.mdc

File: backend/*/middleware/*.js
Auto-triggers: backend.mdc, shared-libraries.mdc, task-verification.mdc, rule-enforcement.mdc

File: backend/*/server.js
Auto-triggers: backend.mdc, shared-libraries.mdc, rule-enforcement.mdc

File: backend/*/prisma/schema.prisma
Auto-triggers: backend.mdc
```

### Task Documentation

```
File: backend/BACKEND_TASK.md
Auto-triggers: task-verification.mdc, rule-enforcement.mdc

File: backend/*/USER_SERVICE_TASK.md
Auto-triggers: task-verification.mdc, rule-enforcement.mdc

File: memory-bank/*.md
Auto-triggers: rule-enforcement.mdc
```

### Frontend Development

```
File: frontend/src/components/**/*.tsx
Auto-triggers: frontend.mdc

File: frontend/src/app/**/*.tsx
Auto-triggers: frontend.mdc

File: frontend/src/hooks/**/*.ts
Auto-triggers: frontend.mdc
```

### Project Configuration

```
File: package.json
Auto-triggers: development-workflow.mdc

File: docker-compose*.yml
Auto-triggers: development-workflow.mdc

File: pnpm-workspace.yaml
Auto-triggers: development-workflow.mdc
```

## 🚀 Key Enforcements

### Backend Rules (Auto-Apply on ALL Backend Files)

**MUST Follow:**

- ✅ Controller methods only (NO inline functions in routes)
- ✅ Prisma ORM only (NEVER raw SQL)
- ✅ Audit logging for all CRUD operations
- ✅ Standard response format (`shared/lib/response.js`)
- ✅ Import paths: `require("../shared/lib/module")`
- ✅ Docker testing before marking task complete

**Import Path Pattern:**

```javascript
// ✅ CORRECT: From controllers/routes/middleware
const logger = require("../shared/lib/logger");
const { APIResponse } = require("../shared/lib/response");

// ✅ CORRECT: From server.js only
const logger = require("./shared/lib/logger");

// ❌ FORBIDDEN
const logger = require("../../shared/lib/logger");
```

### Task Verification (Auto-Apply on Task Files)

**MANDATORY Before Marking Complete:**

```bash
# 1. Restart Docker service
docker-compose restart service-name

# 2. Check logs for errors
docker logs logistics-service-name --tail=30

# 3. Look for MODULE_NOT_FOUND
docker logs logistics-service-name | grep "MODULE_NOT_FOUND"

# 4. Test health endpoint
curl http://localhost:PORT/health

# 5. Test API endpoints
curl -X GET http://localhost:PORT/api/v1/endpoint
```

### Frontend Rules (Auto-Apply on ALL Frontend Files)

**MUST Follow:**

- ✅ TypeScript for all components
- ✅ Functional components with hooks
- ✅ Tailwind CSS for styling
- ✅ Zustand for state management
- ✅ Next.js 14 App Router patterns

## 💡 How It Works

1. **Open any file** - Cursor checks the file path against glob patterns
2. **Match found** - All matching rules auto-activate
3. **Multiple rules** - Can apply simultaneously (e.g., backend.mdc + shared-libraries.mdc)
4. **Context aware** - Right rules for the right files
5. **Always active** - No need to manually activate or mention rules

## ✅ Verification

To verify rules are working in a chat:

1. Mention you're working on a backend controller
   → Rules should reference controller patterns automatically

2. Mention import paths or shared libraries
   → Rules should enforce `../shared/lib/*` pattern

3. Mention task completion
   → Rules should require Docker verification

4. Ask about any backend development
   → Rules should enforce complete standards

## 📚 Related Documentation

- **CLAUDE.md** - Complete project guidance for Claude Code
- **README.md** - Project overview and commands
- **.cursor/rules/** - Individual rule files (6 total)
- **memory-bank/** - Project context files

## 🔧 Maintenance

Rules are automatically maintained through:

- `alwaysApply: true` in all rule files
- Comprehensive glob patterns covering all file types
- Memory bank integration for project context
- Regular updates based on project evolution

---

**Last Updated**: January 2025
**Status**: ✅ All rules configured for auto-apply
**Coverage**: 100% of backend, frontend, and configuration files
