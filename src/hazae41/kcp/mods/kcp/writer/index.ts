import { Writable } from '../../../../binary/mod.ts';
import { Future } from '../../../../future/index.ts';
import { KcpSegment } from '../segment/index';
import { SecretKcpDuplex } from '../stream/index';

export class SecretKcpWriter {
  constructor(readonly parent: SecretKcpDuplex) {}

  async onWrite(fragment: Writable) {
    const { lowDelay = 300, highDelay = 3000 } = this.parent.params;

    const conversation = this.parent.conversation;
    const command = KcpSegment.commands.push;
    const serial = this.parent.sendCounter++;
    const unackSerial = this.parent.recvCounter;

    const segment = KcpSegment.newOrThrow({
      conversation,
      command,
      serial,
      unackSerial,
      fragment,
    });

    this.parent.output.enqueue(segment);

    const start = Date.now();

    const retry = setInterval(() => {
      if (this.parent.closed) {
        clearInterval(retry);
        return;
      }

      const delay = Date.now() - start;

      if (delay > highDelay) {
        clearInterval(retry);
        return;
      }

      this.parent.output.enqueue(segment);
    }, lowDelay);

    const { resolveOnClose, resolveOnError } = this.parent;

    const resolveOnAck = new Future<void>();

    Promise.race([
      resolveOnAck.promise,
      resolveOnClose.promise,
      resolveOnError.promise,
    ]).finally(() => clearInterval(retry));

    this.parent.resolveOnAckBySerial.set(serial, resolveOnAck);
  }
}
