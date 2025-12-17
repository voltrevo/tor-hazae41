import { Option } from './option';
import { Some } from './some';

async function doNoRun(option: Option<number>) {
  const mapped = option
    .mapSync(x => x + 2)
    .mapSync(x => x * 2)
    .zip(new Some('lol'))
    .mapSync(([x, y]) => {}).inner;
}
