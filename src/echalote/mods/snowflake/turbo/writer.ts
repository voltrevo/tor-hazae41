import { Unknown, Writable } from '../../../../hazae41/binary/mod.js';
import { TurboFrame } from './frame.js';
import { SecretTurboDuplex } from './stream.js';

export class SecretTurboWriter {
  constructor(readonly parent: SecretTurboDuplex) {}

  async onStart() {
    await this.parent.resolveOnStart.promise;

    const token = this.parent.class.token;
    this.parent.output.enqueue(new Unknown(token));

    const client = this.parent.client;
    this.parent.output.enqueue(new Unknown(client));
  }

  async onWrite(fragment: Writable) {
    const frame = TurboFrame.createOrThrow({ padding: false, fragment });
    this.parent.output.enqueue(frame);
  }
}
