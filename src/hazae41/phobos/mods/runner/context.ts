import type { Closure } from './closure';
import { TestError } from './error';

export interface Context {
  readonly name: string;

  test(name: string, closure: Closure): Promise<void>;
}

export namespace Context {
  export function test(name: string, closure: Closure): void {
    return Standalone.test(name, closure);
  }

  export class Standalone implements Context {
    constructor(readonly name: string) {
      this.test = this.test.bind(this);
    }

    static test(name: string, closure: Closure) {
      (async () => {
        try {
          await closure(new Standalone(name));
        } catch (cause: unknown) {
          throw new TestError(name, { cause });
        }
      })().catch(console.error);
    }

    async test(name: string, closure: Closure): Promise<void> {
      try {
        const subcontext = new Standalone(name);

        await closure(subcontext);

        return;
      } catch (cause: unknown) {
        throw new TestError(name, { cause });
      }
    }
  }
}
