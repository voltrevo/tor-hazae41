import type { Closure } from '../../../mods/runner/closure/mod';
import { Context } from '../../../mods/runner/context/mod';

/**
 * Run a test block
 * @param name message to show
 * @param closure closure to run
 * @returns result of closure
 */
export function test(name: string, closure: Closure): void {
  return Context.test(name, closure);
}
