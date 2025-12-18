import { Echalote } from '../hazae41/echalote';

/**
 * Predicate function to check if a relay is suitable for middle hop.
 * Middle relays require: Fast + Stable + V2Dir flags.
 */
export function isMiddleRelay(
  relay: Echalote.Consensus.Microdesc.Head
): boolean {
  return (
    relay.flags.includes('Fast') &&
    relay.flags.includes('Stable') &&
    relay.flags.includes('V2Dir')
  );
}

/**
 * Predicate function to check if a relay is suitable for exit hop.
 * Exit relays require: Fast + Stable + Exit flags, and must NOT have BadExit flag.
 */
export function isExitRelay(relay: Echalote.Consensus.Microdesc.Head): boolean {
  return (
    relay.flags.includes('Fast') &&
    relay.flags.includes('Stable') &&
    relay.flags.includes('Exit') &&
    !relay.flags.includes('BadExit')
  );
}
