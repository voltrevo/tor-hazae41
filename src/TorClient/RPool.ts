import { IClock } from '../clock';
import { Log } from '../Log';
import { assert } from '../utils/assert';
import { getErrorDetails } from '../utils/getErrorDetails';
import { EventEmitter } from './EventEmitter';

export class RPool<R> extends EventEmitter<{
  update(): void;
  created(): void;
  failed(): void;
}> {
  private pool: R[] = [];
  private inFlight: Promise<R>[] = [];
  private log: Log;
  private clock: IClock;
  private failCount = 0;
  private lastFailTime = 0;

  constructor(
    public readonly opt: {
      targetSize: number;
      minInFlight: number;
      factory: () => Promise<R>;
      log: Log;
      clock: IClock;
    }
  ) {
    super();

    this.log = opt.log;
    this.clock = opt.clock;

    this.maintenanceLoop();
  }

  async pop(): Promise<R> {
    this.ensureInFlight();

    while (this.pool.length === 0) {
      await this.nextUpdate();
    }

    const r = this.pool.shift();
    assert(r);

    this.emit('update');

    return r;
  }

  private maintenanceLoop() {
    (async () => {
      while (true) {
        while (this.pool.length + this.inFlight.length < this.opt.targetSize) {
          this.pushInFlight();
        }

        await this.nextUpdate();
      }
    })();
  }

  private async ensureInFlight() {
    if (this.pool.length > 0) {
      return;
    }

    while (this.inFlight.length < this.opt.minInFlight) {
      this.pushInFlight();
    }
  }

  private pushInFlight() {
    const p = (async () => {
      if (this.failCount > 0) {
        const timeElapsed = this.clock.now() - this.lastFailTime;
        let totalDelay = 5_000 * 1.1 ** this.failCount;

        if (totalDelay > 60_000) {
          totalDelay = 60_000;
        }

        const netDelay = totalDelay - timeElapsed;

        await this.clock.delayUnref(netDelay);
      }

      return this.opt.factory();
    })();

    this.inFlight.push(p);

    p.then(
      r => {
        this.inFlight = this.inFlight.filter(inFlightP => inFlightP !== p);
        this.pool.push(r);
        this.failCount = 0;
        this.emit('created');
        this.emit('update');
      },
      e => {
        this.failCount++;
        this.log.error(getErrorDetails(e));
        this.inFlight = this.inFlight.filter(inFlightP => inFlightP !== p);
        this.emit('failed');
        this.emit('update');
      }
    );
  }

  private async nextUpdate() {
    return new Promise<void>(resolve => {
      this.once('update', resolve);
    });
  }
}
