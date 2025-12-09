# FIXME #1: Refactor CircuitManager for Testability

## Summary

Extract CircuitManager's sub-components into separate classes for better testability and maintainability. Currently CircuitManager is ~900 lines mixing buffer management, circuit building, state tracking, and timer scheduling.

## Current Problem

- CircuitManager is a monolith (~900 lines)
- Multiple concerns mixed together:
  - Circuit creation & relay extension
  - Buffer management (FIFO queue, sizing)
  - State tracking (per-circuit lifecycle)
  - Backoff strategy (exponential retry logic)
  - Timer scheduling (updates, idle cleanup)
- Hard to unit test components in isolation
- High cognitive load to understand any single feature
- Difficult to change one aspect without affecting others

## Desired Architecture

Extract 4 sub-components, each with single responsibility:

```
CircuitManager (orchestrator, ~400-500 lines)
  ├── CircuitBuilder (circuit creation, ~150-200 lines)
  ├── CircuitBuffer (pool management, ~80-120 lines)
  ├── CircuitStateTracker (state machine, ~100-150 lines)
  └── BackoffStrategy (retry logic, ~50-80 lines)
```

## Component Designs

### 1. CircuitBuilder

**Responsibility:** Create individual circuits through relay extensions

**Public Interface:**

```typescript
class CircuitBuilder {
  constructor(
    private torConnection: TorClientDuplex,
    private getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>,
    private log: Log,
    private clock: IClock
  )

  async buildCircuit(): Promise<Circuit>
}
```

**What it does:**

- Create new circuit (torConnection.createOrThrow())
- Fetch consensus
- Select and extend through middle relay
- Select and extend through exit relay
- Retry logic (up to 10 attempts)

**What it doesn't do:**

- Buffer management
- State tracking
- Timer scheduling
- Backoff strategy

**Tests:**

```
- buildCircuit: successful path
- buildCircuit: relay extension failure (mid circuit)
- buildCircuit: relay extension failure (exit circuit)
- buildCircuit: all 10 attempts fail
- buildCircuit: circuit disposal on failure
```

---

### 2. CircuitBuffer

**Responsibility:** Maintain FIFO pool of ready circuits

**Public Interface:**

```typescript
class CircuitBuffer {
  constructor(private maxSize: number)

  add(circuit: Circuit): void
  takeOldest(): Circuit | null
  size(): number
  peek(): Circuit | null
  dispose(): void
}
```

**What it does:**

- Store circuits in FIFO order
- Take oldest on demand
- Track current size
- Dispose all on close

**What it doesn't do:**

- Create circuits
- State tracking
- Idle cleanup timers
- Backoff

**Tests:**

```
- add: single circuit
- add: multiple circuits (FIFO order)
- takeOldest: returns oldest
- takeOldest: returns null when empty
- size: returns correct count
- add after take: maintains order
- add: respects max size (or no enforcement?)
```

---

### 3. CircuitStateTracker

**Responsibility:** Track per-circuit state (allocation, updating, idle)

**Public Interface:**

```typescript
type CircuitStatus =
  | 'buffered'
  | 'allocating'
  | 'allocated'
  | 'updating'
  | 'disposed';

interface CircuitStateSnapshot {
  status: CircuitStatus;
  allocatedHost?: string;
  allocatedAt?: number;
  isUpdating: boolean;
  updateDeadline: number;
  lastUsed: number;
}

class CircuitStateTracker {
  constructor();

  initialize(circuit: Circuit): void;
  allocate(circuit: Circuit, host: string): void;
  deallocate(circuit: Circuit): void;
  markUpdating(circuit: Circuit, deadline: number): void;
  markNotUpdating(circuit: Circuit): void;
  markUsed(circuit: Circuit): void;
  get(circuit: Circuit): CircuitStateSnapshot;
  dispose(circuit: Circuit): void;
}
```

**What it does:**

- Initialize state for new circuit
- Allocate circuit to host
- Deallocate circuit
- Track update lifecycle
- Track last-used time
- Provide state snapshots
- Cleanup on dispose

**What it doesn't do:**

- Create circuits
- Build circuits
- Schedule timers
- Backoff strategy

**Tests:**

```
- initialize: circuit starts in 'buffered' state
- allocate: transitions 'buffered' → 'allocated', sets host
- deallocate: transitions 'allocated' → 'buffered', clears host
- markUpdating: sets deadline
- markNotUpdating: clears deadline
- markUsed: updates lastUsed timestamp
- get: returns current snapshot
- dispose: clears all state
- state transitions: invalid transitions throw
```

---

### 4. BackoffStrategy

**Responsibility:** Compute retry backoff delays with exponential growth and reset

**Public Interface:**

```typescript
class BackoffStrategy {
  constructor(
    private minMs: number = 5000,
    private maxMs: number = 60000,
    private multiplier: number = 1.1
  )

  getNextDelay(timeSinceLastAttempt: number): number
  reset(): void
  getCurrentDelay(): number
}
```

**What it does:**

- Calculate next delay based on current delay × multiplier
- Enforce min/max bounds
- Reset to min on success
- Pure logic, no side effects

**What it doesn't do:**

- Actually wait
- Manage timers
- Circuit creation

**Tests:**

```
- first delay: returns MIN
- exponential growth: each call × multiplier
- max cap: never exceeds MAX
- reset: returns to MIN
- sequence: min → ... → max → max (stays at max)
- reset after max: goes back to min
- custom multiplier: uses custom value
```

---

### 5. Refactored CircuitManager

**Responsibility:** Orchestrate the above components

**Structure:**

```typescript
class CircuitManager {
  private buffer: CircuitBuffer
  private stateTracker: CircuitStateTracker
  private builder: CircuitBuilder
  private backoff: BackoffStrategy

  // Timer management
  private updateTimers: Map<Circuit, ...>
  private idleTimers: Map<Circuit, ...>

  // Host/circuit tracking
  private hostCircuitMap: Map<string, Circuit>
}
```

**Methods:**

- `getOrCreateCircuit(hostname)` → orchestrate buffer + builder
- `updateCircuit(hostname)` → orchestrate builder + stateTracker
- `clearCircuit(hostname)` → orchestrate stateTracker + buffer
- `waitForCircuitReady()` → check buffer/creation state
- `getCircuitStatus()` → query stateTracker
- etc.

**What changed:**

- Delegates circuit building to CircuitBuilder
- Delegates buffer management to CircuitBuffer
- Delegates state tracking to CircuitStateTracker
- Delegates backoff to BackoffStrategy
- Focuses on orchestration and timer management

**Reduced from:** ~900 lines  
**Reduces to:** ~400-500 lines

---

## Implementation Plan

### Phase 1: Create new component classes

1. Create `src/TorClient/CircuitBuilder.ts`
2. Create `src/TorClient/CircuitBuffer.ts`
3. Create `src/TorClient/CircuitStateTracker.ts`
4. Create `src/TorClient/BackoffStrategy.ts`

Each extracts relevant code from CircuitManager.

### Phase 2: Refactor CircuitManager

1. Update CircuitManager to use new components
2. Remove extracted code
3. Verify no breaking changes to public API

### Phase 3: Create tests

```
src/TorClient/__tests__/
  CircuitBuilder.test.ts
  CircuitBuffer.test.ts
  CircuitStateTracker.test.ts
  BackoffStrategy.test.ts
  CircuitManager.integration.test.ts
```

### Phase 4: Verify

- All tests pass
- Build passes
- No regressions in existing behavior

## Migration Strategy

**Key point:** Keep CircuitManager API unchanged

- Internal refactoring only
- TorClient doesn't change
- All exports remain the same
- Tests can verify behavior hasn't changed

## Testing Approach

**Unit tests per component:**

- CircuitBuilder: mock torConnection, getConsensus
- CircuitBuffer: no mocks needed (pure data structure)
- CircuitStateTracker: no mocks needed (state only)
- BackoffStrategy: no mocks needed (pure math)

**Integration tests for CircuitManager:**

- Test component interactions
- Test full lifecycle (create → allocate → use → update → clear)
- Focus on orchestration logic

## Benefits

✅ **Testability:** Each component has <200 lines, high test coverage possible  
✅ **Maintainability:** Clear responsibilities, easier to understand  
✅ **Reusability:** Components could be used elsewhere  
✅ **Debugging:** Easier to isolate issues to specific components  
✅ **Changes:** Adding features affects smaller, focused classes

## Questions to Resolve

1. **Error handling:** Should components throw or return Optional?
   - Recommendation: Throw errors, let CircuitManager handle

2. **Logging:** Should components log or return errors for caller to log?
   - Recommendation: Components can log debug info, CircuitManager logs important events

3. **Configuration:** Should CircuitBuilder receive maxAttempts, timeout as params?
   - Recommendation: Yes, injected in constructor for flexibility

4. **Circular dependencies:** Could components reference each other?
   - Answer: No, maintain one-way dependency: CircuitManager → components

5. **Mocking strategy:** For tests, should we mock components in CircuitManager tests?
   - Recommendation: Test real components (integration), not mock

## Estimated Effort

6-8 hours

- Component extraction: 2-3 hours
- Test writing: 3-4 hours
- Integration: 1-2 hours

## Risk Level

Low - Pure refactoring, no behavior changes

## Success Criteria

✅ All tests pass (new + existing)  
✅ Build passes without errors  
✅ No changes to public API  
✅ CircuitManager <500 lines  
✅ Each component <200 lines  
✅ High test coverage on components (>90%)
