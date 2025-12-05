import { SystemClock } from './SystemClock';
import { VirtualClock } from './VirtualClock';

async function runExamples() {
  // Example 1: SystemClock - uses real time
  console.log('=== SystemClock Example ===');
  const systemClock = new SystemClock();

  console.log('Current time:', systemClock.now());

  // Using delay() - preferred method
  systemClock.delay(100).then(() => {
    console.log('SystemClock: Delay resolved after 100ms');
  });

  // Using setTimeout() - still available
  systemClock.setTimeout(() => {
    console.log('SystemClock: Timer executed after 100ms');
  }, 100);

  // Example 2: VirtualClock - manual mode
  console.log('\n=== VirtualClock Manual Mode Example ===');
  const manualClock = new VirtualClock();

  console.log('Initial time:', manualClock.now());

  // Using delay() - preferred method (refed)
  manualClock.delay(2000).then(() => {
    console.log('ManualClock: Delay resolved at 2000ms');
  });

  // Using delayUnref() - for background/non-blocking delays
  manualClock.delayUnref(1000).then(() => {
    console.log('ManualClock: DelayUnref resolved at 1000ms');
  });

  // Using setTimeout() - still available
  manualClock.setTimeout(() => {
    console.log('ManualClock: Timer at 3000ms');
  }, 3000);

  console.log('Advancing time to 5000ms...');
  await manualClock.advanceTime(5000);
  console.log('Final time:', manualClock.now());

  // Example 3: VirtualClock - automated mode
  console.log('\n=== VirtualClock Automated Mode Example ===');
  const automatedClock = new VirtualClock({ automated: true });

  // Using delay() - preferred method (refed)
  automatedClock.delay(2000).then(() => {
    console.log('AutomatedClock: Delay resolved at 2000ms');
  });

  // Using delayUnref() - for background/non-blocking delays
  automatedClock.delayUnref(1000).then(() => {
    console.log('AutomatedClock: DelayUnref resolved at 1000ms');
  });

  // Using setTimeout() - still available
  automatedClock.setTimeout(() => {
    console.log('AutomatedClock: Timer at 3000ms');
  }, 3000);

  console.log('Running automated event loop...');
  await automatedClock.run();
  console.log('AutomatedClock: All timers completed');
  console.log('Final time:', automatedClock.now());
}

runExamples().catch(console.error);
