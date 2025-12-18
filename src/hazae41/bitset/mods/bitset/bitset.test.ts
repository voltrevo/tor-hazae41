import { assert, test, throws } from '../../../phobos/mod';
import { Bitset } from './bitset';

test('Identity', async () => {
  const bitset = new Bitset(0b00000000, 8);

  assert(bitset.getBE(0) === false);
  assert(bitset.toString() === '00000000');
});

test('Enable then disable', async () => {
  const bitset = new Bitset(0b00000000, 8);

  bitset.enableLE(1);
  assert(bitset.getLE(1) === true);
  assert(bitset.toString() === '00000010');

  bitset.disableLE(1);
  assert(bitset.getLE(1) === false);
  assert(bitset.toString() === '00000000');

  bitset.enableBE(1);
  assert(bitset.getBE(1) === true);
  assert(bitset.toString() === '01000000');

  bitset.disableBE(1);
  assert(bitset.getBE(1) === false);
  assert(bitset.toString() === '00000000');
});

test('Toggle then toggle', async () => {
  const bitset = new Bitset(0b00000000, 8);

  bitset.toggleLE(1);
  assert(bitset.getLE(1) === true);
  assert(bitset.toString() === '00000010');

  bitset.toggleLE(1);
  assert(bitset.getLE(1) === false);
  assert(bitset.toString() === '00000000');

  bitset.toggleBE(1);
  assert(bitset.getBE(1) === true);
  assert(bitset.toString() === '01000000');

  bitset.toggleBE(1);
  assert(bitset.getBE(1) === false);
  assert(bitset.toString() === '00000000');
});

test('Export Int32 to Uint32', async () => {
  const bitset = new Bitset(0, 32);

  bitset.toggleBE(0); // -2147483648

  const buffer = Buffer.alloc(4);

  assert(
    throws(() => buffer.writeUInt32BE(bitset.value, 0)),
    `Writing value should throw`
  );

  bitset.unsign();

  assert(
    !throws(() => buffer.writeUInt32BE(bitset.value, 0)),
    `Writing unsigned value should not throw`
  );
});

test('First', async () => {
  const bitset = new Bitset(0b11100011, 8);

  assert(bitset.first(2).value === 3);
  assert(bitset.first(3).value === 7);
});

test('Last', async () => {
  const bitset = new Bitset(0b11100111, 8);

  assert(bitset.last(2).value === 3);
  assert(bitset.last(3).value === 7);
});
