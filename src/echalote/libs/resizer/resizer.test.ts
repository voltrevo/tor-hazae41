import { test } from '@hazae41/phobos';
import { assert } from '../../../utils/assert';
import { Resizer } from './resizer.js';
import { Writable } from '@hazae41/binary';
import { Bytes } from '../../../hazae41/bytes';
import { Cursor } from '../../../hazae41/cursor/mod';

test('Resizer - constructor with defaults', async () => {
  const resizer = new Resizer();
  assert(resizer.minimum === 2 ** 10, 'minimum should be 1024');
  assert(resizer.maximum === 2 ** 20, 'maximum should be 1048576');
  assert(resizer.inner instanceof Cursor);
  assert(
    resizer.inner.length === 2 ** 10,
    'initial buffer should match minimum'
  );
});

test('Resizer - constructor with custom min/max', async () => {
  const resizer = new Resizer(512, 4096);
  assert(resizer.minimum === 512);
  assert(resizer.maximum === 4096);
  assert(resizer.inner.length === 512);
});

test('Resizer - writeOrThrow with small chunk', async () => {
  const resizer = new Resizer();
  const chunk = Bytes.from([1, 2, 3, 4, 5]);

  resizer.writeOrThrow(chunk);
  assert(resizer.inner.offset === 5, 'offset should advance by chunk length');
});

test('Resizer - writeOrThrow multiple times within buffer', async () => {
  const resizer = new Resizer(256, 1024);
  const chunk1 = Bytes.alloc(100);
  const chunk2 = Bytes.alloc(100);

  chunk1[0] = 10;
  chunk2[0] = 20;

  resizer.writeOrThrow(chunk1);
  assert(resizer.inner.offset === 100);

  resizer.writeOrThrow(chunk2);
  assert(resizer.inner.offset === (200 as number));
});

test('Resizer - writeOrThrow triggers resize when needed', async () => {
  const resizer = new Resizer(100, 1000);

  // Write data that exceeds initial buffer
  const largeChunk = Bytes.alloc(150);
  resizer.writeOrThrow(largeChunk);

  assert(resizer.inner.length >= 150, 'buffer should be resized');
  assert(
    resizer.inner.offset === 150,
    'offset should be at end of written data'
  );
});

test('Resizer - writeOrThrow preserves previous data on resize', async () => {
  const resizer = new Resizer(100, 1000);
  const chunk1 = Bytes.from([1, 2, 3]);
  const chunk2 = Bytes.alloc(150);

  resizer.writeOrThrow(chunk1);
  const offsetAfterFirst = resizer.inner.offset;

  resizer.writeOrThrow(chunk2);

  // Verify first chunk is still there
  const buffer = resizer.inner.before;
  assert(buffer[0] === 1);
  assert(buffer[1] === 2);
  assert(buffer[2] === 3);
  assert(resizer.inner.offset === offsetAfterFirst + 150);
});

test('Resizer - writeOrThrow throws when exceeding maximum', async () => {
  const resizer = new Resizer(100, 200);

  try {
    // Try to write more than maximum allows
    const chunk = Bytes.alloc(150);
    resizer.writeOrThrow(chunk);
    resizer.writeOrThrow(chunk); // This should exceed maximum

    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Maximum size exceeded'));
  }
});

test('Resizer - writeOrThrow throws when single chunk exceeds maximum', async () => {
  const resizer = new Resizer(100, 200);

  try {
    const chunk = Bytes.alloc(250); // Exceeds maximum
    resizer.writeOrThrow(chunk);
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Maximum size exceeded'));
  }
});

test('Resizer - writeFromOrThrow with Writable', async () => {
  const resizer = new Resizer(256, 2048);

  // Create a simple writable that writes 20 bytes
  const writable: Writable = {
    sizeOrThrow: () => 20,
    writeOrThrow: (cursor: Cursor) => {
      const data = Bytes.alloc(20);
      for (let i = 0; i < 20; i++) data[i] = i;
      cursor.writeOrThrow(data);
    },
  };

  resizer.writeFromOrThrow(writable);
  assert(resizer.inner.offset === 20, 'offset should be 20 after write');
});

test('Resizer - writeFromOrThrow triggers resize', async () => {
  const resizer = new Resizer(100, 1000);

  const writable: Writable = {
    sizeOrThrow: () => 150,
    writeOrThrow: (cursor: Cursor) => {
      const data = Bytes.alloc(150);
      cursor.writeOrThrow(data);
    },
  };

  resizer.writeFromOrThrow(writable);
  assert(resizer.inner.length >= 150);
  assert(resizer.inner.offset === 150);
});

test('Resizer - writeFromOrThrow throws on maximum exceeded', async () => {
  const resizer = new Resizer(100, 200);

  const writable: Writable = {
    sizeOrThrow: () => 250,
    writeOrThrow: () => {},
  };

  try {
    resizer.writeFromOrThrow(writable);
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Maximum size exceeded'));
  }
});

test('Resizer - writeFromOrThrow preserves data from previous writes', async () => {
  const resizer = new Resizer(256, 2048);

  const writable1: Writable = {
    sizeOrThrow: () => 10,
    writeOrThrow: (cursor: Cursor) => {
      const data = Bytes.from([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
      cursor.writeOrThrow(data);
    },
  };

  const writable2: Writable = {
    sizeOrThrow: () => 5,
    writeOrThrow: (cursor: Cursor) => {
      const data = Bytes.from([15, 16, 17, 18, 19]);
      cursor.writeOrThrow(data);
    },
  };

  resizer.writeFromOrThrow(writable1);
  resizer.writeFromOrThrow(writable2);

  const buffer = resizer.inner.before;
  assert(buffer[0] === 5);
  assert(buffer[9] === 14);
  assert(buffer[10] === 15);
  assert(buffer[14] === 19);
});

test('Resizer - sequential writes and multiple resizes', async () => {
  const resizer = new Resizer(50, 500);

  // Multiple writes that trigger multiple resizes
  const chunk = Bytes.alloc(40);
  for (let i = 0; i < 5; i++) {
    resizer.writeOrThrow(chunk);
  }

  assert(resizer.inner.offset === 200);
  assert(resizer.inner.length >= 200);
  assert(resizer.inner.length <= 500);
});

test('Resizer - exact maximum size fits', async () => {
  const resizer = new Resizer(100, 100);
  const chunk = Bytes.alloc(100);

  resizer.writeOrThrow(chunk);
  assert(resizer.inner.offset === 100);
  assert(resizer.inner.length === 100);
});

test('Resizer - exceeding by 1 byte beyond maximum throws', async () => {
  const resizer = new Resizer(100, 100);

  try {
    const chunk = Bytes.alloc(101);
    resizer.writeOrThrow(chunk);
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Maximum size exceeded'));
  }
});

test('Resizer - constructor with custom min/max', async () => {
  const resizer = new Resizer(512, 4096);
  assert(resizer.minimum === 512);
  assert(resizer.maximum === 4096);
  assert(resizer.inner.length === 512);
});

test('Resizer - writeOrThrow with small chunk', async () => {
  const resizer = new Resizer();
  const chunk = Bytes.from([1, 2, 3, 4, 5]);

  resizer.writeOrThrow(chunk);
  assert(resizer.inner.offset === 5, 'offset should advance by chunk length');
});

test('Resizer - writeOrThrow multiple times within buffer', async () => {
  const resizer = new Resizer(256, 1024);
  const chunk1 = Bytes.alloc(100);
  const chunk2 = Bytes.alloc(100);

  chunk1[0] = 10;
  chunk2[0] = 20;

  resizer.writeOrThrow(chunk1);
  assert(resizer.inner.offset === 100);

  resizer.writeOrThrow(chunk2);
  assert(resizer.inner.offset === (200 as number));
});

test('Resizer - writeOrThrow triggers resize when needed', async () => {
  const resizer = new Resizer(100, 1000);

  // Write data that exceeds initial buffer
  const largeChunk = Bytes.alloc(150);
  resizer.writeOrThrow(largeChunk);

  assert(resizer.inner.length >= 150, 'buffer should be resized');
  assert(
    resizer.inner.offset === 150,
    'offset should be at end of written data'
  );
});

test('Resizer - writeOrThrow preserves previous data on resize', async () => {
  const resizer = new Resizer(100, 1000);
  const chunk1 = Bytes.from([1, 2, 3]);
  const chunk2 = Bytes.alloc(150);

  resizer.writeOrThrow(chunk1);
  const offsetAfterFirst = resizer.inner.offset;

  resizer.writeOrThrow(chunk2);

  // Verify first chunk is still there
  const buffer = resizer.inner.before;
  assert(buffer[0] === 1);
  assert(buffer[1] === 2);
  assert(buffer[2] === 3);
  assert(resizer.inner.offset === offsetAfterFirst + 150);
});

test('Resizer - writeOrThrow throws when exceeding maximum', async () => {
  const resizer = new Resizer(100, 200);

  try {
    // Try to write more than maximum allows
    const chunk = Bytes.alloc(150);
    resizer.writeOrThrow(chunk);
    resizer.writeOrThrow(chunk); // This should exceed maximum

    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Maximum size exceeded'));
  }
});

test('Resizer - writeOrThrow throws when single chunk exceeds maximum', async () => {
  const resizer = new Resizer(100, 200);

  try {
    const chunk = Bytes.alloc(250); // Exceeds maximum
    resizer.writeOrThrow(chunk);
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Maximum size exceeded'));
  }
});

test('Resizer - writeFromOrThrow with Writable', async () => {
  const resizer = new Resizer(256, 2048);

  // Create a simple writable that writes 20 bytes
  const writable: Writable = {
    sizeOrThrow: () => 20,
    writeOrThrow: (cursor: Cursor) => {
      const data = Bytes.alloc(20);
      for (let i = 0; i < 20; i++) data[i] = i;
      cursor.writeOrThrow(data);
    },
  };

  resizer.writeFromOrThrow(writable);
  assert(resizer.inner.offset === 20, 'offset should be 20 after write');
});

test('Resizer - writeFromOrThrow triggers resize', async () => {
  const resizer = new Resizer(100, 1000);

  const writable: Writable = {
    sizeOrThrow: () => 150,
    writeOrThrow: (cursor: Cursor) => {
      const data = Bytes.alloc(150);
      cursor.writeOrThrow(data);
    },
  };

  resizer.writeFromOrThrow(writable);
  assert(resizer.inner.length >= 150);
  assert(resizer.inner.offset === 150);
});

test('Resizer - writeFromOrThrow throws on maximum exceeded', async () => {
  const resizer = new Resizer(100, 200);

  const writable: Writable = {
    sizeOrThrow: () => 250,
    writeOrThrow: () => {},
  };

  try {
    resizer.writeFromOrThrow(writable);
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Maximum size exceeded'));
  }
});

test('Resizer - writeFromOrThrow preserves data from previous writes', async () => {
  const resizer = new Resizer(256, 2048);

  const writable1: Writable = {
    sizeOrThrow: () => 10,
    writeOrThrow: (cursor: Cursor) => {
      const data = Bytes.from([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
      cursor.writeOrThrow(data);
    },
  };

  const writable2: Writable = {
    sizeOrThrow: () => 5,
    writeOrThrow: (cursor: Cursor) => {
      const data = Bytes.from([15, 16, 17, 18, 19]);
      cursor.writeOrThrow(data);
    },
  };

  resizer.writeFromOrThrow(writable1);
  resizer.writeFromOrThrow(writable2);

  const buffer = resizer.inner.before;
  assert(buffer[0] === 5);
  assert(buffer[9] === 14);
  assert(buffer[10] === 15);
  assert(buffer[14] === 19);
});

test('Resizer - sequential writes and multiple resizes', async () => {
  const resizer = new Resizer(50, 500);

  // Multiple writes that trigger multiple resizes
  const chunk = Bytes.alloc(40);
  for (let i = 0; i < 5; i++) {
    resizer.writeOrThrow(chunk);
  }

  assert(resizer.inner.offset === 200);
  assert(resizer.inner.length >= 200);
  assert(resizer.inner.length <= 500);
});

test('Resizer - exact maximum size fits', async () => {
  const resizer = new Resizer(100, 100);
  const chunk = Bytes.alloc(100);

  resizer.writeOrThrow(chunk);
  assert(resizer.inner.offset === 100);
  assert(resizer.inner.length === 100);
});

test('Resizer - exceeding by 1 byte beyond maximum throws', async () => {
  const resizer = new Resizer(100, 100);

  try {
    const chunk = Bytes.alloc(101);
    resizer.writeOrThrow(chunk);
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Maximum size exceeded'));
  }
});
