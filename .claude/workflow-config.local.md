---
folders:
  active: docs/active
  completed: docs/completed
  planning: docs/planning

validation_commands:
  - pnpm --filter @bearded-nemesis/frontend check
  - pnpm --filter @bearded-nemesis/api build
  - pnpm lint
  - pnpm test

code_review:
  block_on_severity: HIGH

verification:
  max_iterations: 5

changelog_format: keepachangelog
---

# Workflow Configuration

This file configures the benzhaus plugin workflow for the bearded-nemesis project.

## Validation Commands

Before completing work and creating PRs, these commands must pass:

1. **Frontend Type Check** - Validates SvelteKit types and component props
2. **API Build** - Compiles TypeScript to ensure type safety
3. **Lint** - Runs ESLint across all packages
4. **Test** - Runs all Vitest tests (API + Frontend)

## Code Review

- **Severity Threshold**: HIGH
  - CRITICAL issues block completion
  - HIGH issues block completion
  - MEDIUM issues are warnings only
  - LOW issues are informational

## Notes

- This is a pnpm workspace monorepo
- Always use `pnpm` (never `npm`)
- Build `packages/shared` before running apps
- Solver service is Python/FastAPI (separate validation)
