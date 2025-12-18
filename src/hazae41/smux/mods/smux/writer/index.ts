import { Empty, Writable } from '../../../../binary/mod';
import { SmuxSegment, SmuxUpdate } from '../segment';
import { SecretSmuxDuplex } from '../stream';

export type SmuxWriteError = PeerWindowOverflow;

export class PeerWindowOverflow extends Error {
  readonly #class = PeerWindowOverflow;
  readonly name = this.#class.name;

  constructor() {
    super(`Peer window reached`);
  }
}

export class SecretSmuxWriter {
  constructor(readonly parent: SecretSmuxDuplex) {}

  async onStart() {
    await this.parent.resolveOnStart.promise;

    await this.#sendSynOrThrow();
    await this.#sendUpdOrThrow();
  }

  async #sendSynOrThrow() {
    const version = 2;
    const command = SmuxSegment.commands.syn;
    const stream = this.parent.stream;
    const fragment = new Empty();

    const segment = SmuxSegment.empty({ version, command, stream, fragment });

    this.parent.output.enqueue(segment);
  }

  async #sendUpdOrThrow() {
    const version = 2;
    const command = SmuxSegment.commands.upd;
    const stream = this.parent.stream;
    const fragment = new SmuxUpdate(0, this.parent.selfWindow);

    const segment = SmuxSegment.newOrThrow({
      version,
      command,
      stream,
      fragment,
    });

    this.parent.output.enqueue(segment);
  }

  async onWrite(fragment: Writable) {
    const inflight = this.parent.selfWrite - this.parent.peerConsumed;

    if (inflight >= this.parent.peerWindow) throw new PeerWindowOverflow();

    const version = 2;
    const command = SmuxSegment.commands.psh;
    const stream = this.parent.stream;

    const segment = SmuxSegment.newOrThrow({
      version,
      command,
      stream,
      fragment,
    });

    this.parent.output.enqueue(segment);

    this.parent.selfWrite += segment.fragmentSize;
  }
}
