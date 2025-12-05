# Agent Loop Pattern

This document describes the autonomous feedback loop pattern used by AI agents when taking the lead on a project.

## Overview

When an AI agent is asked to "take the lead" on a project, it operates in a **continuous feedback loop**, self-managing task discovery, execution, and validation without waiting for external prompts.

## The Loop Structure

```
┌─────────────────────────────────────────┐
│  1. Assess Current State                │
│     - Read README, package.json, TODO   │
│     - Run linting, tests, build         │
│     - Identify issues and opportunities │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Plan Work                           │
│     - Create todo list                  │
│     - Prioritize improvements           │
│     - Balance quick wins vs impact      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Execute Tasks                       │
│     - Work on high-priority items       │
│     - Run tests after each change       │
│     - Commit progress regularly         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Validate & Verify                   │
│     - Run linting                       │
│     - Run full test suite               │
│     - Build the project                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  5. Discover Next Opportunity           │
│     - Explore codebase for issues       │
│     - Look for patterns and anti-patterns
│     - Find related problems to fix      │
│     - Update todo list                  │
└──────────────┬──────────────────────────┘
               │
               └──────────────┐
                              │ Continue loop
                              │ until satisifed
                              ▼
```

## Key Principles

### 1. **Self-Directed**

- No external prompts needed for continuation
- Agent decides what to work on next
- Determines when tasks are complete

### 2. **Balance Quality and Quantity**

- Prefer quick wins to build momentum
- Don't get stuck on complex problems
- Try something else if blocked (use git to restore state)
- Mix easy fixes with more challenging improvements

### 3. **Continuous Validation**

- Run tests after each change
- Check linting frequently
- Build regularly to catch issues early
- Verify everything still works

### 4. **Strategic Task Selection**

- Start with easy, high-impact fixes
- Progress to more complex improvements
- Use exploration tools to find opportunities
- Prioritize based on:
  - **High Impact** - Fixes that improve multiple areas
  - **Quick Execution** - Tasks that complete rapidly
  - **Low Risk** - Changes unlikely to break things

### 5. **Version Control as Safety Net**

- Commit frequently after each significant change
- Use git to restore to previous points if needed
- Commits create clear record of improvements
- Enables rolling back problematic changes

## Task Categories

### Quick Wins (5-30 minutes)

- Fix linting errors
- Remove unused code
- Add missing parameters to function calls
- Fix typos in comments
- Improve type safety in simple ways

### Medium Tasks (30 minutes - 2 hours)

- Refactor duplicated code
- Improve error handling
- Add type guards
- Optimize performance hotspots
- Add documentation

### Complex Tasks (2+ hours)

- Major refactoring
- New feature implementation
- Architecture improvements
- Writing tests
- Large documentation efforts

## Exploration Techniques

### 1. **Automated Assessment**

```bash
npm run lint      # Find code quality issues
npm run test      # Check for broken functionality
npm run build     # Catch type errors
npm run format:check  # Find formatting issues
```

### 2. **Codebase Analysis**

- Search for patterns: TODO, FIXME, console calls
- Find large files that might need refactoring
- Identify duplicated code
- Look for type unsafety (any casts, loose types)

### 3. **Test-Driven Validation**

- Run tests after each change
- Verify build succeeds
- Check linting passes
- Ensure no regressions

## Example Session

This project demonstrates the agent loop in action:

1. **Assessment**: Ran linting → Found 25 errors
2. **Planning**: Created todo with 6 items
3. **Execution**: Fixed linting (3 commits)
4. **Validation**: All tests pass, build succeeds
5. **Discovery**: Explored for code quality issues → Found 10 opportunities
6. **Execution**: Fixed parseInt radix, resource cleanup, error handling (3 more commits)
7. **Validation**: Tests, lint, build all green
8. **Loop**: Continue searching for more improvements

**Result**: 9 commits, 0 linting errors, all tests passing, cleaner codebase

## When to Continue vs. Stop

### Continue When:

- ✅ Tests still pass
- ✅ Build succeeds
- ✅ New opportunities discovered
- ✅ Previous changes validated
- ✅ Momentum is good (finding related issues)

### Stop When:

- ❌ Hit a complex problem requiring design decisions
- ❌ Too many consecutive failed attempts on same issue
- ❌ Changes would require extensive refactoring
- ❌ Core functionality might be affected
- ❌ Remaining tasks are very low-impact

## Communication

The agent should:

- Update todo list as work progresses
- Commit frequently with clear messages
- Explain each improvement
- Note when switching between task types
- Summarize progress at key milestones

## Tools & Patterns

### Essential Commands

```bash
npm run lint              # Check code quality
npm run test              # Run test suite
npm run build             # Build and type check
npm run format:check      # Check formatting
git status                # See current changes
git add -A                # Stage changes
git commit -m "message"   # Save progress
git log --oneline         # Review commits
```

### Git as Safety Net

```bash
# If something goes wrong:
git restore <file>        # Undo changes to file
git reset HEAD~1          # Undo last commit
git checkout main         # Go back to main branch
```

## Feedback Loop in This Project

This document was created after the agent completed an improvement session on tor-hazae41:

1. Fixed 25 linting errors
2. Optimized hot paths
3. Fixed type safety issues
4. Improved resource cleanup
5. Added better error handling

Each improvement built on the previous one, following the feedback loop pattern to continuously improve code quality.
