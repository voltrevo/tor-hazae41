import { test, expect } from 'vitest';
import { Resizer } from './Resizer.js';
import { Bytes } from '../bytes';
import { Cursor } from '../cursor/mod';
import { Writable } from '../binary/mod';

test('Resizer - constructor with defaults', async () => {
  const resizer = new Resizer();
  expect(resizer.minimum === 2 ** 10).toBe(true);
  expect(resizer.maximum === 2 ** 20).toBe(true);
  expect(resizer.inner instanceof Cursor).toBe(true);
  expect(resizer.inner.length === 2 ** 10).toBe(true);
});

test('Resizer - constructor with custom min/max', async () => {
  const resizer = new Resizer(512, 4096);
  expect(resizer.minimum === 512).toBe(true);
  expect(resizer.maximum === 4096).toBe(true);
  expect(resizer.inner.length === 512).toBe(true);
});

test('Resizer - writeOrThrow with small chunk', async () => {
  const resizer = new Resizer();
  const chunk = Bytes.from([1, 2, 3, 4, 5]);

  resizer.writeOrThrow(chunk);
  expect(resizer.inner.offset === 5).toBe(true);
});

test('Resizer - writeOrThrow multiple times within buffer', async () => {
  const resizer = new Resizer(256, 1024);
  const chunk1 = Bytes.alloc(100);
  const chunk2 = Bytes.alloc(100);

  chunk1[0] = 10;
  chunk2[0] = 20;

  resizer.writeOrThrow(chunk1);
  expect(resizer.inner.offset === 100).toBe(true);

  resizer.writeOrThrow(chunk2);
  expect(resizer.inner.offset === (200 as number)).toBe(true);
});

test('Resizer - writeOrThrow triggers resize when needed', async () => {
  const resizer = new Resizer(100, 1000);

  // Write data that exceeds initial buffer
  const largeChunk = Bytes.alloc(150);
  resizer.writeOrThrow(largeChunk);

  expect(resizer.inner.length >= 150).toBe(true);
  expect(resizer.inner.offset === 150).toBe(true);
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
  expect(buffer[0] === 1).toBe(true);
  expect(buffer[1] === 2).toBe(true);
  expect(buffer[2] === 3).toBe(true);
  expect(resizer.inner.offset === offsetAfterFirst + 150).toBe(true);
});

test('Resizer - writeOrThrow throws when exceeding maximum', async () => {
  const resizer = new Resizer(100, 200);

  try {
    // Try to write more than maximum allows
    const chunk = Bytes.alloc(150);
    resizer.writeOrThrow(chunk);
    resizer.writeOrThrow(chunk); // This should exceed maximum

    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes('Maximum size exceeded')).toBe(
      true
    );
  }
});

test('Resizer - writeOrThrow throws when single chunk exceeds maximum', async () => {
  const resizer = new Resizer(100, 200);

  try {
    const chunk = Bytes.alloc(250); // Exceeds maximum
    resizer.writeOrThrow(chunk);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes('Maximum size exceeded')).toBe(
      true
    );
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
  expect(resizer.inner.offset === 20).toBe(true);
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
  expect(resizer.inner.length >= 150).toBe(true);
  expect(resizer.inner.offset === 150).toBe(true);
});

test('Resizer - writeFromOrThrow throws on maximum exceeded', async () => {
  const resizer = new Resizer(100, 200);

  const writable: Writable = {
    sizeOrThrow: () => 250,
    writeOrThrow: () => {},
  };

  try {
    resizer.writeFromOrThrow(writable);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes('Maximum size exceeded')).toBe(
      true
    );
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
  expect(buffer[0] === 5).toBe(true);
  expect(buffer[9] === 14).toBe(true);
  expect(buffer[10] === 15).toBe(true);
  expect(buffer[14] === 19).toBe(true);
});

test('Resizer - sequential writes and multiple resizes', async () => {
  const resizer = new Resizer(50, 500);

  // Multiple writes that trigger multiple resizes
  const chunk = Bytes.alloc(40);
  for (let i = 0; i < 5; i++) {
    resizer.writeOrThrow(chunk);
  }

  expect(resizer.inner.offset === 200).toBe(true);
  expect(resizer.inner.length >= 200).toBe(true);
  expect(resizer.inner.length <= 500).toBe(true);
});

test('Resizer - exact maximum size fits', async () => {
  const resizer = new Resizer(100, 100);
  const chunk = Bytes.alloc(100);

  resizer.writeOrThrow(chunk);
  expect(resizer.inner.offset === 100).toBe(true);
  expect(resizer.inner.length === 100).toBe(true);
});

test('Resizer - exceeding by 1 byte beyond maximum throws', async () => {
  const resizer = new Resizer(100, 100);

  try {
    const chunk = Bytes.alloc(101);
    resizer.writeOrThrow(chunk);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes('Maximum size exceeded')).toBe(
      true
    );
  }
});

test('Resizer - constructor with custom min/max', async () => {
  const resizer = new Resizer(512, 4096);
  expect(resizer.minimum === 512).toBe(true);
  expect(resizer.maximum === 4096).toBe(true);
  expect(resizer.inner.length === 512).toBe(true);
});

test('Resizer - writeOrThrow with small chunk', async () => {
  const resizer = new Resizer();
  const chunk = Bytes.from([1, 2, 3, 4, 5]);

  resizer.writeOrThrow(chunk);
  expect(resizer.inner.offset === 5).toBe(true);
});

test('Resizer - writeOrThrow multiple times within buffer', async () => {
  const resizer = new Resizer(256, 1024);
  const chunk1 = Bytes.alloc(100);
  const chunk2 = Bytes.alloc(100);

  chunk1[0] = 10;
  chunk2[0] = 20;

  resizer.writeOrThrow(chunk1);
  expect(resizer.inner.offset === 100).toBe(true);

  resizer.writeOrThrow(chunk2);
  expect(resizer.inner.offset === (200 as number)).toBe(true);
});

test('Resizer - writeOrThrow triggers resize when needed', async () => {
  const resizer = new Resizer(100, 1000);

  // Write data that exceeds initial buffer
  const largeChunk = Bytes.alloc(150);
  resizer.writeOrThrow(largeChunk);

  expect(resizer.inner.length >= 150).toBe(true);
  expect(resizer.inner.offset === 150).toBe(true);
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
  expect(buffer[0] === 1).toBe(true);
  expect(buffer[1] === 2).toBe(true);
  expect(buffer[2] === 3).toBe(true);
  expect(resizer.inner.offset === offsetAfterFirst + 150).toBe(true);
});

test('Resizer - writeOrThrow throws when exceeding maximum', async () => {
  const resizer = new Resizer(100, 200);

  try {
    // Try to write more than maximum allows
    const chunk = Bytes.alloc(150);
    resizer.writeOrThrow(chunk);
    resizer.writeOrThrow(chunk); // This should exceed maximum

    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes('Maximum size exceeded')).toBe(
      true
    );
  }
});

test('Resizer - writeOrThrow throws when single chunk exceeds maximum', async () => {
  const resizer = new Resizer(100, 200);

  try {
    const chunk = Bytes.alloc(250); // Exceeds maximum
    resizer.writeOrThrow(chunk);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes('Maximum size exceeded')).toBe(
      true
    );
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
  expect(resizer.inner.offset === 20).toBe(true);
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
  expect(resizer.inner.length >= 150).toBe(true);
  expect(resizer.inner.offset === 150).toBe(true);
});

test('Resizer - writeFromOrThrow throws on maximum exceeded', async () => {
  const resizer = new Resizer(100, 200);

  const writable: Writable = {
    sizeOrThrow: () => 250,
    writeOrThrow: () => {},
  };

  try {
    resizer.writeFromOrThrow(writable);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes('Maximum size exceeded')).toBe(
      true
    );
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
  expect(buffer[0] === 5).toBe(true);
  expect(buffer[9] === 14).toBe(true);
  expect(buffer[10] === 15).toBe(true);
  expect(buffer[14] === 19).toBe(true);
});

test('Resizer - sequential writes and multiple resizes', async () => {
  const resizer = new Resizer(50, 500);

  // Multiple writes that trigger multiple resizes
  const chunk = Bytes.alloc(40);
  for (let i = 0; i < 5; i++) {
    resizer.writeOrThrow(chunk);
  }

  expect(resizer.inner.offset === 200).toBe(true);
  expect(resizer.inner.length >= 200).toBe(true);
  expect(resizer.inner.length <= 500).toBe(true);
});

test('Resizer - exact maximum size fits', async () => {
  const resizer = new Resizer(100, 100);
  const chunk = Bytes.alloc(100);

  resizer.writeOrThrow(chunk);
  expect(resizer.inner.offset === 100).toBe(true);
  expect(resizer.inner.length === 100).toBe(true);
});

test('Resizer - exceeding by 1 byte beyond maximum throws', async () => {
  const resizer = new Resizer(100, 100);

  try {
    const chunk = Bytes.alloc(101);
    resizer.writeOrThrow(chunk);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes('Maximum size exceeded')).toBe(
      true
    );
  }
});
