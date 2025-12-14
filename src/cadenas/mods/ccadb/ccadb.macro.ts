/**
 * @macro delete-next-lines
 */
import { PEM, X509 } from "@hazae41/x509"
import fs from "fs/promises"

import { Writable } from "@hazae41/binary"
import { Nullable } from "@hazae41/option"

declare function $run$<T>(fn: () => Promise<T>): T

export namespace CCADB {

  export interface Trusted {
    readonly hashBase16: string
    readonly certBase16: string
    readonly notAfter?: string
  }

  export const trusteds: Record<string, Nullable<Trusted>> = $run$(async () => {
    interface Row {
      "Distrust for TLS After Date": string,
      "Mozilla Applied Constraints": string
      "PEM": `'${string}'`
    }

    const now = new Date()

    const ccadb = await fs.readFile("./tools/ccadb/ccadb.json", "utf8")
    const certs = JSON.parse(ccadb) as Row[]

    const trusteds: Record<string, Trusted> = {}

    for (const cert of certs) {
      try {
        const pem = PEM.decodeOrThrow(cert.PEM.slice(1, -1))
        const x509 = X509.readAndResolveFromBytesOrThrow(X509.Certificate, pem)

        const spki = Writable.writeToBytesOrThrow(x509.tbsCertificate.subjectPublicKeyInfo.toDER())
        const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", spki))

        const x501 = x509.tbsCertificate.subject.toX501OrThrow()

        const certBase16 = Buffer.from(pem).toString("hex")
        const hashBase16 = Buffer.from(hash).toString("hex")

        if (trusteds[x501]) {
          console.warn(hashBase16, `Duplicated`)
          continue
        }

        const notAfter = cert["Distrust for TLS After Date"]

        if (notAfter && now > new Date(notAfter)) {
          console.warn(hashBase16, `Expired at ${notAfter}`)
          continue
        }

        if (cert["Mozilla Applied Constraints"]) {
          console.warn(hashBase16, `Mozilla Applied Constraints ${cert["Mozilla Applied Constraints"]}`)
          continue
        }

        trusteds[x501] = { hashBase16, certBase16, notAfter }
      } catch (e: unknown) {
        console.warn(e)
      }
    }

    return trusteds
  })

}