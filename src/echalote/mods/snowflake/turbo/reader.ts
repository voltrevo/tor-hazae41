import { Unknown } from '../../../../hazae41/binary/mod.js';
import { TurboFrame } from './frame.js';
import { SecretTurboDuplex } from './stream.js';

export class SecretTurboReader {
  constructor(readonly parent: SecretTurboDuplex) {}

  async onWrite(chunk: Unknown) {
    const frame = chunk.readIntoOrThrow(TurboFrame);

    if (frame.padding) return;

    this.parent.input.enqueue(frame.fragment);
  }
}
