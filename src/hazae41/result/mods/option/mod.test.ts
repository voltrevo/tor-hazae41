// deno-lint-ignore-file
import { Option } from './option/mod';
import { Some } from './some/mod';

async function doNoRun(option: Option<number>) {
  const mapped = option
    .mapSync(x => x + 2)
    .mapSync(x => x * 2)
    .zip(new Some('lol'))
    .mapSync(([x, y]) => {}).inner;
}
