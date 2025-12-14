import { ClientHello2 } from "./binary/records/handshakes/client_hello/client_hello2.js"
import { ECPointFormats } from "./binary/records/handshakes/extensions/ec_point_formats/ec_point_formats.js"
import { EllipticCurves } from "./binary/records/handshakes/extensions/elliptic_curves/elliptic_curves.js"
import { ServerNameList } from "./binary/records/handshakes/extensions/server_name/server_name_list.js"
import { SignatureAlgorithms } from "./binary/records/handshakes/extensions/signature_algorithms/signature_algorithms.js"
import { ServerHello2 } from "./binary/records/handshakes/server_hello/server_hello2.js"

export interface Extensions {
  server_name?: ServerNameList,
  signature_algorithms?: SignatureAlgorithms,
  elliptic_curves?: EllipticCurves,
  ec_point_formats?: ECPointFormats
}

export type TlsExtensionError =
  | UnsupportedExtensionError
  | DuplicatedExtensionError
  | UnexpectedExtensionError

export class UnsupportedExtensionError extends Error {
  readonly #class = UnsupportedExtensionError
  readonly name = this.#class.name

  constructor(
    readonly type: number
  ) {
    super(`Unsupported extension ${type}`)
  }

}

export class DuplicatedExtensionError extends Error {
  readonly #class = DuplicatedExtensionError
  readonly name = this.#class.name

  constructor(
    readonly type: number
  ) {
    super(`Duplicated extension ${type}`)
  }

}

export class UnexpectedExtensionError extends Error {
  readonly #class = UnexpectedExtensionError
  readonly name = this.#class.name

  constructor(
    readonly type: number
  ) {
    super(`Unexpected extension ${type}`)
  }

}

export namespace Extensions {

  export function getClientExtensions(client_hello: ClientHello2) {
    const client_extensions: Extensions = {}

    if (client_hello.extensions.isNone())
      return client_extensions

    for (const extension of client_hello.extensions.inner.value.array) {

      if (extension.data.value instanceof SignatureAlgorithms) {
        client_extensions.signature_algorithms = extension.data.value
        continue
      }

      if (extension.data.value instanceof EllipticCurves) {
        client_extensions.elliptic_curves = extension.data.value
        continue
      }

      if (extension.data.value instanceof ECPointFormats) {
        client_extensions.ec_point_formats = extension.data.value
        continue
      }

      if (extension.data.value instanceof ServerNameList) {
        client_extensions.server_name = extension.data.value
        continue
      }

      throw new UnsupportedExtensionError(extension.type)
    }

    return client_extensions
  }

  export function getServerExtensions(server_hello: ServerHello2, client_extensions: Extensions) {
    const server_extensions: Extensions = {}

    if (server_hello.extensions.isNone())
      return server_extensions

    const types = new Set<number>()

    for (const extension of server_hello.extensions.inner.value.array) {

      if (types.has(extension.type))
        throw new DuplicatedExtensionError(extension.type)

      types.add(extension.type)

      if (extension.data.value instanceof SignatureAlgorithms) {
        if (!client_extensions.signature_algorithms)
          throw new UnexpectedExtensionError(extension.type)

        server_extensions.signature_algorithms = extension.data.value
        continue
      }

      if (extension.data.value instanceof EllipticCurves) {
        if (!client_extensions.elliptic_curves)
          throw new UnexpectedExtensionError(extension.type)

        server_extensions.elliptic_curves = extension.data.value
        continue
      }

      if (extension.data.value instanceof ECPointFormats) {
        if (!client_extensions.ec_point_formats)
          throw new UnexpectedExtensionError(extension.type)

        server_extensions.ec_point_formats = extension.data.value
        continue
      }

      if (extension.type === ServerNameList.extension_type) {
        if (!client_extensions.server_name)
          throw new UnexpectedExtensionError(extension.type)

        /**
         * NOOP: TODO: server_name is empty from server
         */
        continue
      }

      throw new UnsupportedExtensionError(extension.type)
    }

    return server_extensions
  }

}