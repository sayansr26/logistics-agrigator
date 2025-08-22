# Frontend Code Review Guidelines

This document outlines the key areas to focus on during frontend code reviews and common issues to avoid based on our project's patterns and requirements.

## Table of Contents

- [1. React Import and JSX Usage](#1-react-import-and-jsx-usage)
- [2. Import Management](#2-import-management)
- [3. Variable and Function Usage](#3-variable-and-function-usage)
- [4. React Hooks Best Practices](#4-react-hooks-best-practices)
- [5. TypeScript Usage](#5-typescript-usage)
- [6. Component Organization](#6-component-organization)
- [7. State Management](#7-state-management)
- [8. Console Statements](#8-console-statements)
- [9. Code Quality Tools](#9-code-quality-tools)
- [10. Pre-Commit Checklist](#10-pre-commit-checklist)
- [11. Development Workflow](#11-development-workflow)
- [12. Performance Considerations](#12-performance-considerations)

## 1. React Import and JSX Usage

### ✅ DO:

- Always import React when using JSX syntax:
  ```typescript
  import React from "react";
  ```
- Add React import even in Next.js 14 projects for components using React types (ReactNode, etc.)
- Keep React imports at the top of the file, before other imports

### ❌ DON'T:

- Skip React imports when using React types or JSX
- Remove React imports just because the file compiles without errors

## 2. Import Management

### ✅ DO:

- Only import components and icons that are actually used in the file
- Use named imports for better tree-shaking:
  ```typescript
  import { Button, Card } from "@/components/ui";
  import { User, Settings } from "lucide-react";
  ```
- Group imports by category:
  1. React/Next.js imports
  2. External libraries
  3. Internal components/utilities
  4. Types/interfaces
  5. Styles

### ❌ DON'T:

- Import entire icon libraries or component sets when only a few are needed
- Keep unused imports "just in case"
- Mix different types of imports without organization

## 3. Variable and Function Usage

### ✅ DO:

- Prefix unused parameters with underscore:
  ```typescript
  const handleChange = (_event: React.ChangeEvent) => {
    // Implementation
  };
  ```
- Use TypeScript's unused variable pattern:
  ```typescript
  const [, setData] = useState<Data>(null); // Only setter is used
  ```
- Remove or comment out unused state variables and functions

### ❌ DON'T:

- Leave unused variables in the code
- Keep commented-out code or "future use" variables
- Ignore TypeScript/ESLint warnings about unused variables

## 4. React Hooks Best Practices

### ✅ DO:

- Include all dependencies in useEffect dependency arrays:
  ```typescript
  useEffect(() => {
    // Effect implementation
  }, [requiredDep1, requiredDep2]);
  ```
- Use useCallback for functions passed as props
- Add ESLint comments only when intentionally omitting dependencies:
  ```typescript
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Effect with intentionally omitted deps
  }, []);
  ```

### ❌ DON'T:

- Leave dependency arrays empty without reason
- Ignore React hooks exhaustive deps warnings
- Create unnecessary dependencies in useEffect

## 5. TypeScript Usage

### ✅ DO:

- Define proper types for all props:
  ```typescript
  interface ComponentProps {
    data: Data;
    onUpdate: (newData: Data) => void;
  }
  ```
- Use TypeScript's strict mode
- Leverage type inference when possible

### ❌ DON'T:

- Use `any` type unless absolutely necessary
- Ignore TypeScript warnings
- Create overly complex type structures

## 6. Component Organization

### ✅ DO:

- Keep components focused and single-responsibility
- Split large components into smaller, reusable pieces
- Use proper file and folder structure:
  ```
  components/
  ├── ui/          # Basic UI components
  ├── features/    # Feature-specific components
  ├── layout/      # Layout components
  └── forms/       # Form components
  ```

### ❌ DON'T:

- Create large, monolithic components
- Mix different component responsibilities
- Duplicate component logic

## 7. State Management

### ✅ DO:

- Use appropriate state management tools (Zustand in our case)
- Keep state updates clean and predictable
- Split state into logical stores

### ❌ DON'T:

- Mix different state management approaches
- Create unnecessary global state
- Mutate state directly

## 8. Console Statements

### ✅ DO:

- Use proper error handling and logging services
- Remove all console.log statements before committing
- Use development-only logging if needed:
  ```typescript
  if (process.env.NODE_ENV === "development") {
    console.log("Debug info");
  }
  ```

### ❌ DON'T:

- Leave console.log statements in production code
- Use console.log for error handling
- Commit code with debugging statements

## 9. Code Quality Tools

### ✅ DO:

- Run linting before commits:
  ```bash
  pnpm lint
  pnpm lint:fix
  ```
- Use TypeScript's strict mode
- Follow ESLint and Prettier configurations
- Run type checking:
  ```bash
  pnpm type-check
  ```

### ❌ DON'T:

- Ignore linter warnings
- Disable ESLint rules without good reason
- Skip type checking

## 10. Pre-Commit Checklist

✅ Before committing code:

1. Run `pnpm lint:fix` to fix automatic issues
2. Run `pnpm type-check` to verify types
3. Run `pnpm build` to ensure successful build
4. Remove all console.log statements
5. Remove unused imports and variables
6. Check React hooks dependencies
7. Verify component props and types

## 11. Development Workflow

### ✅ DO:

- Use feature branches for development
- Write meaningful commit messages
- Keep PRs focused and manageable
- Document complex logic or workarounds
- Follow the established project structure

### ❌ DON'T:

- Work directly on main/master branch
- Skip code reviews
- Ignore TypeScript/ESLint warnings
- Leave TODOs without tickets

## 12. Performance Considerations

### ✅ DO:

- Use proper code splitting
- Optimize imports for tree shaking
- Implement proper memoization
- Follow Next.js best practices

### ❌ DON'T:

- Import entire libraries unnecessarily
- Ignore bundle size warnings
- Skip performance optimizations

## Code Review Process

When reviewing frontend code, follow this checklist:

1. **Initial Overview**
   - Check file organization and component structure
   - Review imports and dependencies
   - Look for obvious code smells

2. **Detailed Review**
   - Verify React patterns and hooks usage
   - Check TypeScript types and interfaces
   - Review state management implementation
   - Validate error handling
   - Check for performance implications

3. **Testing and Quality**
   - Ensure tests are present and meaningful
   - Verify linting passes
   - Check build success
   - Review bundle size impact

4. **Documentation**
   - Check component documentation
   - Review inline comments
   - Verify API documentation updates

5. **Final Verification**
   - Run the application locally
   - Test the changes
   - Verify no regressions

## Common Review Comments

Use these standardized comments for common issues:

- 🔍 "Consider using more specific types instead of 'any'"
- 🧹 "Remove unused imports/variables"
- 🪝 "Add missing dependencies to useEffect"
- 📦 "Consider breaking this component into smaller pieces"
- 🎯 "Add proper error handling"
- 🔄 "Use proper state management pattern"
- 📝 "Add missing documentation"
- ⚡ "Consider performance implications"

## Conclusion

These guidelines should be treated as living documentation. Update them as new patterns emerge or when we discover better practices. Regular reviews of these guidelines help maintain code quality and consistency across the project.

Remember: The goal of code review is not just to catch bugs, but to ensure maintainable, performant, and high-quality code that follows project standards.
