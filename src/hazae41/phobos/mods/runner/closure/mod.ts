import type { Awaitable } from '../../../libs/awaitable/mod';
import type { Context } from '../mod';

export type Closure = (context: Context) => Awaitable<void>;
