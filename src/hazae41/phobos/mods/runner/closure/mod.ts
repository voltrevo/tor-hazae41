import type { Awaitable } from '../../../libs/awaitable/mod.ts';
import type { Context } from '../mod.ts';

export type Closure = (context: Context) => Awaitable<void>;
