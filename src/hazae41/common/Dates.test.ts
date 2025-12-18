import { test, expect } from 'vitest';
import { Dates } from './Dates';

test('Dates.fromMillis - converts milliseconds to Date', async () => {
  const millis = 1000;
  const date = Dates.fromMillis(millis);

  expect(date instanceof Date).toBe(true);
  expect(date.getTime() === millis).toBe(true);
});

test('Dates.fromMillis - with zero milliseconds', async () => {
  const date = Dates.fromMillis(0);

  expect(date instanceof Date).toBe(true);
  expect(date.getTime() === 0).toBe(true);
});

test('Dates.toMillis - converts Date to milliseconds', async () => {
  const date = new Date(5000);
  const millis = Dates.toMillis(date);

  expect(typeof millis === 'number').toBe(true);
  expect(millis === 5000).toBe(true);
});

test('Dates.fromSeconds - converts seconds to Date', async () => {
  const seconds = 10;
  const date = Dates.fromSeconds(seconds);

  expect(date instanceof Date).toBe(true);
  expect(date.getTime() === 10000).toBe(true);
});

test('Dates.fromSeconds - with zero seconds', async () => {
  const date = Dates.fromSeconds(0);

  expect(date.getTime() === 0).toBe(true);
});

test('Dates.toSeconds - converts Date to seconds (floored)', async () => {
  const date = new Date(5500); // 5.5 seconds
  const seconds = Dates.toSeconds(date);

  expect(typeof seconds === 'number').toBe(true);
  expect(seconds === 5).toBe(true); // Should be floored
});

test('Dates.toSeconds - with exact second boundary', async () => {
  const date = new Date(6000); // 6 seconds
  const seconds = Dates.toSeconds(date);

  expect(seconds === 6).toBe(true);
});

test('Dates.fromMillisDelay - creates future date from milliseconds', async () => {
  const now = Date.now();
  const futureDate = Dates.fromMillisDelay(1000);

  expect(futureDate instanceof Date).toBe(true);
  expect(futureDate.getTime() >= now + 1000).toBe(true);
  expect(futureDate.getTime() <= now + 1100).toBe(true); // Allow small tolerance
});

test('Dates.fromMillisDelay - with zero milliseconds', async () => {
  const now = Date.now();
  const date = Dates.fromMillisDelay(0);

  expect(date.getTime() >= now).toBe(true);
  expect(date.getTime() <= now + 50).toBe(true);
});

test('Dates.toMillisDelay - calculates time until future date', async () => {
  const now = Date.now();
  const futureDate = new Date(now + 2000);
  const delay = Dates.toMillisDelay(futureDate);

  expect(typeof delay === 'number').toBe(true);
  expect(delay >= 1900).toBe(true);
  expect(delay <= 2100).toBe(true);
});

test('Dates.toMillisDelay - with past date (negative delay)', async () => {
  const now = Date.now();
  const pastDate = new Date(now - 1000);
  const delay = Dates.toMillisDelay(pastDate);

  expect(delay < 0).toBe(true);
  expect(delay <= -900).toBe(true);
  expect(delay >= -1100).toBe(true);
});

test('Dates.fromSecondsDelay - creates future date from seconds', async () => {
  const now = Date.now();
  const futureDate = Dates.fromSecondsDelay(5);

  expect(futureDate instanceof Date).toBe(true);
  expect(futureDate.getTime() >= now + 5000).toBe(true);
  expect(futureDate.getTime() <= now + 5100).toBe(true);
});

test('Dates.toSecondsDelay - calculates time until future date (floored)', async () => {
  const now = Date.now();
  const futureDate = new Date(now + 3500); // 3.5 seconds
  const delay = Dates.toSecondsDelay(futureDate);

  expect(typeof delay === 'number').toBe(true);
  expect(delay === 3).toBe(true); // Should be floored
});

test('Dates.toSecondsDelay - with past date (negative delay)', async () => {
  const now = Date.now();
  const pastDate = new Date(now - 2500); // 2.5 seconds ago
  const delay = Dates.toSecondsDelay(pastDate);

  expect(delay < 0).toBe(true);
  expect(delay === -2 || delay === -3).toBe(true); // Floored negative
});

test('Dates round-trip: millis -> Date -> millis', async () => {
  const originalMillis = 12345;
  const date = Dates.fromMillis(originalMillis);
  const result = Dates.toMillis(date);

  expect(result === originalMillis).toBe(true);
});

test('Dates round-trip: seconds -> Date -> seconds', async () => {
  const originalSeconds = 6789;
  const date = Dates.fromSeconds(originalSeconds);
  const result = Dates.toSeconds(date);

  expect(result === originalSeconds).toBe(true);
});

test('Dates consistency: 1000 millis = 1 second', async () => {
  const millisDate = Dates.fromMillis(1000);
  const secondsDate = Dates.fromSeconds(1);

  expect(Dates.toMillis(millisDate) === Dates.toMillis(secondsDate)).toBe(true);
});

test('Dates.fromMillisDelay and toMillisDelay round-trip', async () => {
  const delayMs = 2000;
  const futureDate = Dates.fromMillisDelay(delayMs);
  const calculatedDelay = Dates.toMillisDelay(futureDate);

  // Allow some tolerance due to time passing during test
  expect(calculatedDelay >= delayMs - 100).toBe(true);
  expect(calculatedDelay <= delayMs + 100).toBe(true);
});

test('Dates.fromSecondsDelay and toSecondsDelay round-trip', async () => {
  const delaySeconds = 3;
  const futureDate = Dates.fromSecondsDelay(delaySeconds);
  const calculatedDelay = Dates.toSecondsDelay(futureDate);

  // Allow tolerance due to flooring and time passing
  expect(calculatedDelay >= delaySeconds - 1).toBe(true);
  expect(calculatedDelay <= delaySeconds).toBe(true);
});

test('Dates.fromSeconds with fractional seconds', async () => {
  const date = Dates.fromSeconds(2.5);
  const millis = Dates.toMillis(date);

  expect(millis === 2500).toBe(true);
});

test('Dates with very large timestamps', async () => {
  const largeMillis = 9999999999999;
  const date = Dates.fromMillis(largeMillis);

  expect(Dates.toMillis(date) === largeMillis).toBe(true);
});

test('Dates with negative timestamps (before epoch)', async () => {
  const negativeMillis = -5000;
  const date = Dates.fromMillis(negativeMillis);

  expect(date instanceof Date).toBe(true);
  expect(Dates.toMillis(date) === negativeMillis).toBe(true);
});
