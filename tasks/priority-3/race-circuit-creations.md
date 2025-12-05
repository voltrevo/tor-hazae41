# FIXME #2: Race Multiple Circuit Creations On-Demand

## Summary

When a new circuit is needed and buffer is empty, start multiple circuit creation attempts in parallel instead of just one. Return the first successful one and dispose the others. Reduces latency and improves reliability.

## Current Problem

- Circuit creation is slow (30-90s typical) and often fails
- When buffer is empty and a circuit is needed: create 1 circuit
- If it fails: apply exponential backoff and retry single creation
- User waits for longest in the retry loop

## Desired Behavior

- Add `circuitRaceCount` parameter to CircuitManager (e.g., default 3)
- When buffer needs refill OR circuit needed on-demand: start N circuit creations in parallel
- Return the first one that succeeds
- Dispose the others (or return to buffer if they complete after first success)
- Reduces worst-case latency significantly

## Example Scenario

**Without racing (current):**

```
Need circuit (buffer empty)
  → Try create circuit 1
    - Takes 45s, fails
  → Backoff 5s wait
  → Try create circuit 1
    - Takes 50s, fails
  → Total time to fail: 100s
  → User experiences 100s delay
```

**With racing (desired):**

```
Need circuit (buffer empty)
  → Start create circuits 1, 2, 3 in parallel
    - Circuit 1: takes 45s, fails
    - Circuit 2: takes 40s, succeeds ✓
    - Circuit 3: takes 50s, fails
  → Return circuit 2
  → Total time: 40s
  → User experiences 40s delay
```

## Implementation Steps

### Step 1: Add Configuration Options

**CircuitManagerOptions:**

```typescript
/** Number of circuits to race when creating on-demand (default: 1) */
circuitRaceCount?: number;
```

**TorClientOptions:**

```typescript
/** Number of circuits to race when creating on-demand (default: 1) */
circuitRaceCount?: number;
```

### Step 2: Modify `allocateCircuitToHost()`

Current logic:

```typescript
let circuit = this.getOldestBufferedCircuit();
if (!circuit) {
  circuit = await this.createNewCircuit(); // Single creation
}
```

New logic:

```typescript
let circuit = this.getOldestBufferedCircuit();
if (!circuit) {
  // Race N circuit creations, use first successful
  circuit = await this.raceCircuitCreations(this.circuitRaceCount);
}
```

### Step 3: Implement `raceCircuitCreations(raceCount: number)`

```typescript
/**
 * Race multiple circuit creations in parallel.
 * Returns the first successful circuit and disposes the others.
 */
private async raceCircuitCreations(raceCount: number): Promise<Circuit> {
  if (raceCount <= 1) {
    return await this.createNewCircuit();
  }

  const promises: Promise<Circuit>[] = [];

  // Start N circuit creation attempts in parallel
  for (let i = 0; i < raceCount; i++) {
    promises.push(this.createNewCircuit().catch(e => {
      throw e;  // Preserve error for failed attempts
    }));
  }

  // Race: return first success, dispose others
  let winners = 0;
  try {
    const result = await Promise.race(promises);

    // Dispose losing attempts (fire and forget)
    for (const promise of promises) {
      promise
        .then(circuit => {
          if (winners === 0) {
            // Still waiting for first - this could be it
          } else {
            // We already have winner, dispose this one
            circuit[Symbol.dispose]();
            this.logMessage('Buffered', 'Disposed losing race circuit');
          }
        })
        .catch(() => {
          // Failed attempt, ignore
        });
    }
    winners++;

    return result;
  } catch (error) {
    // All N attempts failed - propagate error
    throw error;
  }
}
```

### Step 4: Update Buffer Maintenance

When refilling buffer, should we use racing?

**Option A:** Always use racing when refilling buffer

- Faster buffer initialization
- More circuit creation attempts = more resource usage

**Option B:** Only use racing when allocating on-demand

- Reserve racing for urgent user requests
- Buffer fills more conservatively

**Recommendation:** Option B - racing is more valuable for user requests that are blocking

### Step 5: Backoff Handling

Current backoff tracks single creation attempts. With racing:

```typescript
/**
 * Apply backoff after failed race attempt.
 * Only applied if ALL N race attempts failed.
 */
private async applyBackoffAndRetry(): Promise<void> {
  // ... existing backoff logic, but now applies to N-race failures
}
```

### Step 6: Logging & Observability

Add logging:

```
[Buffered] Racing 3 circuits...
[Buffered] Circuit 1 succeeded (45s)
[Buffered] Circuit 2 failed - disposed
[Buffered] Circuit 3 failed - disposed
[Buffered] Circuit race won in 45s
```

## Configuration Examples

**No racing (default):**

```typescript
new TorClient({ circuitRaceCount: 1 });
```

**Race 3 circuits:**

```typescript
new TorClient({ circuitRaceCount: 3 });
```

**Aggressive racing:**

```typescript
new TorClient({ circuitRaceCount: 5 });
```

## Questions to Resolve

1. **Default value:** Should default be 1 (no racing) or 3 (aggressive)?
   - Tradeoff: latency vs. resource usage

2. **Race all the time?** Should buffer maintenance also use racing?
   - Option: `circuitRaceCount` vs separate `bufferRaceCount`

3. **Failed races:** After N failed races, what happens?
   - Continue with exponential backoff? (current behavior)
   - Increase raceCount dynamically? (more aggressive)

4. **Disposal order:** For losing race circuits that complete after winner:
   - Dispose immediately?
   - Keep briefly in case winner fails?

## Testing Scenarios

1. **All race attempts fail:**
   - Start 3 creations, all fail
   - Should trigger backoff + retry

2. **First wins:**
   - Start 3 creations, first completes successfully
   - Others disposed

3. **Middle wins:**
   - Start 3: attempts 1 and 2 fail quickly, attempt 3 succeeds
   - Dispose 1 and 2

4. **Racing in buffer refill:**
   - circuitBuffer: 3, needs 2 more
   - Should it race 2x3 creations or sequentially?

5. **Race with circuit failures:**
   - Start 3 creations, all reach relay selection but fail
   - Should apply backoff before next attempt

## Performance Impact

**Positive:**

- Reduced user-facing latency when buffer empty
- Better reliability (multiple attempts)
- Faster buffer initialization on startup

**Negative:**

- 3x resource usage during racing (3 concurrent connections)
- More load on Snowflake bridge during races
- More relay selection attempts

**Recommended:** Start conservative (default 1), allow users to increase if needed

## Estimated Effort

3-4 hours

## Risk Level

Low - Racing is an optimization, doesn't break existing behavior
