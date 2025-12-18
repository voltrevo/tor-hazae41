import { Bytes } from '../../../bytes';

export namespace PEM {
  export const header = `-----BEGIN CERTIFICATE-----`;
  export const footer = `-----END CERTIFICATE-----`;

  export class MissingHeaderError extends Error {
    readonly #class = MissingHeaderError;
    readonly name = this.#class.name;

    constructor() {
      super(`Missing PEM header`);
    }
  }

  export class MissingFooterError extends Error {
    readonly #class = MissingFooterError;
    readonly name = this.#class.name;

    constructor() {
      super(`Missing PEM footer`);
    }
  }

  export function decodeOrThrow(text: string): Bytes {
    text = text.replaceAll(`\n`, ``);

    if (!text.startsWith(header)) throw new MissingHeaderError();
    if (!text.endsWith(footer)) throw new MissingFooterError();

    const body = text.slice(header.length, -footer.length);

    return Bytes.fromBase64(body);
  }

  export function encodeOrThrow(bytes: Bytes): string {
    let result = `${header}\n`;

    let body = Bytes.toBase64(bytes);

    while (body) {
      result += `${body.slice(0, 64)}\n`;
      body = body.slice(64);
    }

    result += `${footer}\n`;

    return result;
  }
}
