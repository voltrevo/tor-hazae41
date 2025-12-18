import { assert } from '../../utils/assert';
import { test } from '../phobos/mod';
import { Dates } from './Dates';

test('Dates.fromMillis - converts milliseconds to Date', async () => {
  const millis = 1000;
  const date = Dates.fromMillis(millis);

  assert(date instanceof Date);
  assert(date.getTime() === millis);
});

test('Dates.fromMillis - with zero milliseconds', async () => {
  const date = Dates.fromMillis(0);

  assert(date instanceof Date);
  assert(date.getTime() === 0);
});

test('Dates.toMillis - converts Date to milliseconds', async () => {
  const date = new Date(5000);
  const millis = Dates.toMillis(date);

  assert(typeof millis === 'number');
  assert(millis === 5000);
});

test('Dates.fromSeconds - converts seconds to Date', async () => {
  const seconds = 10;
  const date = Dates.fromSeconds(seconds);

  assert(date instanceof Date);
  assert(date.getTime() === 10000);
});

test('Dates.fromSeconds - with zero seconds', async () => {
  const date = Dates.fromSeconds(0);

  assert(date.getTime() === 0);
});

test('Dates.toSeconds - converts Date to seconds (floored)', async () => {
  const date = new Date(5500); // 5.5 seconds
  const seconds = Dates.toSeconds(date);

  assert(typeof seconds === 'number');
  assert(seconds === 5); // Should be floored
});

test('Dates.toSeconds - with exact second boundary', async () => {
  const date = new Date(6000); // 6 seconds
  const seconds = Dates.toSeconds(date);

  assert(seconds === 6);
});

test('Dates.fromMillisDelay - creates future date from milliseconds', async () => {
  const now = Date.now();
  const futureDate = Dates.fromMillisDelay(1000);

  assert(futureDate instanceof Date);
  assert(futureDate.getTime() >= now + 1000);
  assert(futureDate.getTime() <= now + 1100); // Allow small tolerance
});

test('Dates.fromMillisDelay - with zero milliseconds', async () => {
  const now = Date.now();
  const date = Dates.fromMillisDelay(0);

  assert(date.getTime() >= now);
  assert(date.getTime() <= now + 50);
});

test('Dates.toMillisDelay - calculates time until future date', async () => {
  const now = Date.now();
  const futureDate = new Date(now + 2000);
  const delay = Dates.toMillisDelay(futureDate);

  assert(typeof delay === 'number');
  assert(delay >= 1900);
  assert(delay <= 2100);
});

test('Dates.toMillisDelay - with past date (negative delay)', async () => {
  const now = Date.now();
  const pastDate = new Date(now - 1000);
  const delay = Dates.toMillisDelay(pastDate);

  assert(delay < 0);
  assert(delay <= -900);
  assert(delay >= -1100);
});

test('Dates.fromSecondsDelay - creates future date from seconds', async () => {
  const now = Date.now();
  const futureDate = Dates.fromSecondsDelay(5);

  assert(futureDate instanceof Date);
  assert(futureDate.getTime() >= now + 5000);
  assert(futureDate.getTime() <= now + 5100);
});

test('Dates.toSecondsDelay - calculates time until future date (floored)', async () => {
  const now = Date.now();
  const futureDate = new Date(now + 3500); // 3.5 seconds
  const delay = Dates.toSecondsDelay(futureDate);

  assert(typeof delay === 'number');
  assert(delay === 3); // Should be floored
});

test('Dates.toSecondsDelay - with past date (negative delay)', async () => {
  const now = Date.now();
  const pastDate = new Date(now - 2500); // 2.5 seconds ago
  const delay = Dates.toSecondsDelay(pastDate);

  assert(delay < 0);
  assert(delay === -2 || delay === -3); // Floored negative
});

test('Dates round-trip: millis -> Date -> millis', async () => {
  const originalMillis = 12345;
  const date = Dates.fromMillis(originalMillis);
  const result = Dates.toMillis(date);

  assert(result === originalMillis);
});

test('Dates round-trip: seconds -> Date -> seconds', async () => {
  const originalSeconds = 6789;
  const date = Dates.fromSeconds(originalSeconds);
  const result = Dates.toSeconds(date);

  assert(result === originalSeconds);
});

test('Dates consistency: 1000 millis = 1 second', async () => {
  const millisDate = Dates.fromMillis(1000);
  const secondsDate = Dates.fromSeconds(1);

  assert(Dates.toMillis(millisDate) === Dates.toMillis(secondsDate));
});

test('Dates.fromMillisDelay and toMillisDelay round-trip', async () => {
  const delayMs = 2000;
  const futureDate = Dates.fromMillisDelay(delayMs);
  const calculatedDelay = Dates.toMillisDelay(futureDate);

  // Allow some tolerance due to time passing during test
  assert(calculatedDelay >= delayMs - 100);
  assert(calculatedDelay <= delayMs + 100);
});

test('Dates.fromSecondsDelay and toSecondsDelay round-trip', async () => {
  const delaySeconds = 3;
  const futureDate = Dates.fromSecondsDelay(delaySeconds);
  const calculatedDelay = Dates.toSecondsDelay(futureDate);

  // Allow tolerance due to flooring and time passing
  assert(calculatedDelay >= delaySeconds - 1);
  assert(calculatedDelay <= delaySeconds);
});

test('Dates.fromSeconds with fractional seconds', async () => {
  const date = Dates.fromSeconds(2.5);
  const millis = Dates.toMillis(date);

  assert(millis === 2500);
});

test('Dates with very large timestamps', async () => {
  const largeMillis = 9999999999999;
  const date = Dates.fromMillis(largeMillis);

  assert(Dates.toMillis(date) === largeMillis);
});

test('Dates with negative timestamps (before epoch)', async () => {
  const negativeMillis = -5000;
  const date = Dates.fromMillis(negativeMillis);

  assert(date instanceof Date);
  assert(Dates.toMillis(date) === negativeMillis);
});
