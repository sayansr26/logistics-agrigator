# Git Workflow & Quality Gates

## 🚀 **Automated Quality Checks**

This project uses **Husky** + **lint-staged** + **commitlint** for automated code quality and commit message standards.

## 🔧 **Pre-Commit Hooks (Smart Linting)**

### **What Happens on `git commit`**
```bash
# 1. Lint-staged runs (only on staged files)
✅ Frontend files: ESLint + TypeScript + Prettier
✅ Backend files: ESLint + Prettier  
✅ Shared files: ESLint + Prettier
✅ Config files: Prettier formatting
✅ Prisma schemas: Prettier formatting

# 2. Commit message validation (commitlint)
✅ Conventional Commits format enforced
✅ Type validation (feat, fix, docs, etc.)
✅ Message length and format rules
```

### **Smart Linting Configuration**
```json
{
  "lint-staged": {
    "frontend/**/*.{js,jsx,ts,tsx}": [
      "pnpm --filter frontend run lint:fix",
      "pnpm --filter frontend run type-check", 
      "prettier --write"
    ],
    "backend/**/*.{js,ts}": [
      "eslint --fix",
      "prettier --write"
    ],
    "shared/**/*.{js,ts}": [
      "eslint --fix",
      "prettier --write" 
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ],
    "**/*.prisma": [
      "prettier --write"
    ]
  }
}
```

## 📝 **Commit Message Standards**

### **Conventional Commits Format**
```bash
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### **Commit Types**
| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add 2FA support` |
| `fix` | Bug fix | `fix(api): resolve CORS issue` |
| `docs` | Documentation | `docs: update README setup` |
| `style` | Code formatting | `style: fix ESLint warnings` |
| `refactor` | Code refactoring | `refactor(db): optimize queries` |
| `perf` | Performance improvement | `perf(api): cache user sessions` |
| `test` | Add/update tests | `test(auth): add login tests` |
| `build` | Build system changes | `build: update Docker config` |
| `ci` | CI/CD changes | `ci: add GitHub Actions` |
| `chore` | Maintenance | `chore: update dependencies` |
| `revert` | Revert changes | `revert: undo feat(auth)` |

### **Examples of Good Commit Messages**
```bash
✅ feat(user): add user profile management API
✅ fix(frontend): resolve login form validation
✅ docs(api): add authentication endpoint examples
✅ refactor(prisma): optimize user queries with relations
✅ test(auth): add comprehensive JWT token tests
✅ chore(deps): update Next.js to v14.1.0
```

### **Examples of Bad Commit Messages**
```bash
❌ update code
❌ Fix bug
❌ working on features
❌ WIP
❌ asdf
❌ Fixed the thing that was broken
```

## 🧪 **Pre-Push Hooks**

### **What Happens on `git push`**
```bash
# 1. Run all tests
🧪 pnpm run test

# 2. Type checking (TypeScript projects)
🔍 pnpm --filter frontend run type-check
🔍 pnpm --filter "backend/*" run type-check

# 3. Build verification
🏗️ pnpm run build

# 4. Success confirmation
✅ Pre-push checks passed!
```

## 🛠️ **Available Commands**

### **Manual Quality Checks**
```bash
# Run lint-staged manually
pnpm run lint:staged

# Interactive commit with conventional format
pnpm run commit

# Validate commit messages
pnpm run commitlint

# Full quality check
pnpm run lint && pnpm run test && pnpm run build
```

### **Bypass Hooks (Emergency Only)**
```bash
# Skip pre-commit hooks (NOT RECOMMENDED)
git commit --no-verify -m "emergency fix"

# Skip pre-push hooks (NOT RECOMMENDED) 
git push --no-verify
```

## 🎯 **Development Workflow**

### **Standard Development Process**
```bash
# 1. Create feature branch
git checkout -b feat/user-profile-api

# 2. Make changes in appropriate directories
# - frontend/ for UI changes
# - backend/ for API changes  
# - shared/ for utilities

# 3. Stage changes
git add .

# 4. Commit (triggers pre-commit hooks)
git commit -m "feat(user): add profile management endpoints"
# OR use interactive commit
pnpm run commit

# 5. Push (triggers pre-push hooks)
git push origin feat/user-profile-api

# 6. Create Pull Request
```

### **Smart Linting Benefits**
- **🚀 Faster commits**: Only lint changed files
- **🎯 Targeted fixes**: Fix only what you're working on
- **⚡ Efficient CI**: Reduced processing time
- **🧹 Clean commits**: Automatically formatted code

## 📊 **Hook Performance**

### **Pre-Commit Hook Timing**
| File Types | Action | Avg Time |
|------------|--------|----------|
| 5-10 TS files | ESLint + Prettier | 3-5 seconds |
| 20-30 JS files | ESLint + Prettier | 5-8 seconds |
| Config files | Prettier only | 1-2 seconds |
| Prisma schemas | Prettier only | 1 second |

### **Pre-Push Hook Timing**
| Action | Avg Time | Notes |
|--------|----------|-------|
| Test suite | 30-60s | Depends on test coverage |
| Type checking | 10-20s | TypeScript compilation |
| Build check | 20-40s | Full build verification |
| **Total** | **60-120s** | Catches issues before CI |

## 🔧 **Configuration Files**

### **Core Configuration**
- **`.husky/pre-commit`**: Runs lint-staged on commit
- **`.husky/commit-msg`**: Validates commit message format  
- **`.husky/pre-push`**: Runs tests and builds before push
- **`commitlint.config.js`**: Commit message rules
- **`package.json`**: lint-staged configuration

### **Lint-Staged Rules**
- **Frontend**: ESLint + TypeScript + Prettier
- **Backend**: ESLint + Prettier
- **Shared**: ESLint + Prettier  
- **Config**: Prettier formatting
- **Prisma**: Schema formatting

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Pre-commit Hook Fails**
```bash
# Fix linting errors
pnpm --filter frontend run lint:fix
pnpm --filter backend/auth-service run lint:fix

# Fix formatting
prettier --write "src/**/*.{js,ts,tsx}"

# Retry commit
git commit -m "feat: your message"
```

#### **TypeScript Errors**
```bash
# Check types in frontend
pnpm --filter frontend run type-check

# Fix types and retry
git add . && git commit -m "fix: resolve TypeScript errors"
```

#### **Commit Message Rejected**
```bash
# Bad: "fix bug"
# Good: "fix(auth): resolve login validation issue"

# Use interactive commit for help
pnpm run commit
```

#### **Pre-push Hook Fails**
```bash
# Fix failing tests
pnpm run test

# Fix build errors
pnpm run build

# Retry push
git push origin your-branch
```

### **Hook Configuration Issues**
```bash
# Reinstall hooks
npx husky install

# Make hooks executable
chmod +x .husky/*

# Verify hook content
cat .husky/pre-commit
```

## ✅ **Quality Gate Benefits**

### **Code Quality**
- **Consistent formatting**: Prettier ensures uniform code style
- **No lint errors**: ESLint catches issues before commit
- **Type safety**: TypeScript errors caught early
- **Standard commits**: Conventional format for better history

### **Development Experience**
- **Faster reviews**: Pre-formatted, pre-linted code
- **Fewer CI failures**: Issues caught locally
- **Better history**: Clear, searchable commit messages
- **Team consistency**: Shared standards across all developers

### **Project Maintenance**
- **Automated changelog**: Conventional commits enable automation
- **Semantic versioning**: Type-based version bumping
- **Release notes**: Auto-generated from commit history
- **Quality metrics**: Track code quality over time

---

## 🎯 **Best Practices**

### **DO**
- ✅ Write descriptive commit messages with proper type
- ✅ Keep commits focused and atomic
- ✅ Let hooks run (they're fast and catch issues)
- ✅ Use `pnpm run commit` for interactive commit help
- ✅ Fix linting/typing issues promptly

### **DON'T**  
- ❌ Skip hooks with `--no-verify` unless emergency
- ❌ Make massive commits across multiple features
- ❌ Use vague commit messages like "fix" or "update"
- ❌ Ignore TypeScript errors in pre-push
- ❌ Commit work-in-progress without proper message

---

**Status**: ✅ **Husky + Smart Linting + Quality Gates Active**  
**Focus**: Only lint changed files, enforce commit standards, catch issues early  
**Benefit**: Higher code quality with minimal developer friction