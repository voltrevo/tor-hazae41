# FIXME #3: Improve `waitForCircuit()` Implementation

## Summary

Replace the fake 'localhost' circuit pattern with proper buffer-aware waiting that checks if circuits are actually ready or being created.

## Current Problem

- `waitForCircuit()` creates a 'localhost' circuit just to know when something is ready
- Allocates a real buffered circuit to a non-existent host
- Wasteful and semantically incorrect

## Desired Behavior

- Wait for CircuitManager to have at least one circuit ready (buffered or in-flight)
- If buffer is empty AND no circuits being created, throw error
- Don't allocate any circuit to a fake host
- Return successfully when buffer has content or creation completes

## Implementation Steps

### Step 1: Add CircuitManager method

Add new method `waitForCircuitReady()` to CircuitManager:

```typescript
/**
 * Waits for at least one circuit to be ready (buffered or in-flight creation).
 * Useful for determining when CircuitManager is initialized and ready for use.
 *
 * @throws Error if circuitBuffer is disabled and no circuits are being created
 * @returns Promise that resolves when a circuit is ready
 */
async waitForCircuitReady(): Promise<void>
```

Logic:

1. If buffer has circuits: return immediately
2. If creation tasks in progress: wait for one to complete
3. If neither: throw error with message like "CircuitManager not configured to create circuits (circuitBuffer=0 and no pending allocations)"

### Step 2: Update TorClient.waitForCircuit()

Replace:

```typescript
async waitForCircuit(): Promise<void> {
  await this.circuitManager.getOrCreateCircuit('localhost');
}
```

With:

```typescript
async waitForCircuit(): Promise<void> {
  await this.circuitManager.waitForCircuitReady();
}
```

### Step 3: Remove localhost allocation pattern

- Update documentation in TorClient to explain that `waitForCircuit()` doesn't allocate circuits
- Add notes about `circuitBuffer` parameter for pre-creation

## Testing Scenarios

1. **Buffer has circuits:**
   - circuitBuffer: 3, circuits: [A, B, C] in buffer
   - Call waitForCircuit() → resolves immediately

2. **Buffer empty but creating:**
   - circuitBuffer: 3, circuits: creating 3 in progress
   - Call waitForCircuit() → waits for first to complete, then resolves

3. **Buffer disabled and nothing creating:**
   - circuitBuffer: 0, no pending allocations
   - Call waitForCircuit() → throws error

4. **Race: buffer fills while waiting:**
   - circuitBuffer: 3, circuits: creating 3, but 1 completes before we call waitForCircuit()
   - Call waitForCircuit() → resolves immediately (buffer now has [completed])

## Estimated Effort

1-2 hours

## Risk Level

Very Low - purely internal refactoring, no external API changes
