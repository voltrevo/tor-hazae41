import { Readable, Writable, Unknown } from '../../../../binary/mod';
import { assert, test } from '../../../../phobos/mod';
import { SmuxSegment } from './index';
import { Bytes } from '../../../../bytes';

test('kcp segment', async () => {
  const version = 2;
  const command = SmuxSegment.commands.psh;
  const stream = 12345;
  const fragment = new Unknown(crypto.getRandomValues(Bytes.alloc(130)));

  const segment = SmuxSegment.newOrThrow({
    version,
    command,
    stream,
    fragment,
  });
  const bytes = Writable.writeToBytesOrThrow(segment);
  const frame2 = Readable.readFromBytesOrThrow(SmuxSegment, bytes);

  assert(Bytes.equals(segment.fragment.bytes, frame2.fragment.bytes));
});
