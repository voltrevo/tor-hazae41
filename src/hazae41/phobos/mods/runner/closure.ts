import { Awaitable } from '../../../common/Awaitable';
import type { Context } from '../mod';

export type Closure = (context: Context) => Awaitable<void>;
