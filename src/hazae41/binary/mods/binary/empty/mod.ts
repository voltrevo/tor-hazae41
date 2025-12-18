import type { Cursor } from '../../../../cursor/mod';

export class Empty {
  constructor() {}

  sizeOrThrow(): 0 {
    return 0;
  }

  // deno-lint-ignore no-unused-vars
  writeOrThrow(_cursor: Cursor) {
    return;
  }

  cloneOrThrow(): this {
    return this;
  }
}

export namespace Empty {
  export function readOrThrow(_cursor: Cursor): Empty {
    return new Empty();
  }
}
