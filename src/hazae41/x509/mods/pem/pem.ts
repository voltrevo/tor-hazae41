import { Base64 } from '../../../base64/index.ts';

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

  export function decodeOrThrow(text: string): Uint8Array<ArrayBuffer> {
    text = text.replaceAll(`\n`, ``);

    if (!text.startsWith(header)) throw new MissingHeaderError();
    if (!text.endsWith(footer)) throw new MissingFooterError();

    const body = text.slice(header.length, -footer.length);

    return Base64.decodePaddedOrThrow(body);
  }

  export function encodeOrThrow(bytes: Uint8Array): string {
    let result = `${header}\n`;

    let body = Base64.encodePaddedOrThrow(bytes);

    while (body) {
      result += `${body.slice(0, 64)}\n`;
      body = body.slice(64);
    }

    result += `${footer}\n`;

    return result;
  }
}
