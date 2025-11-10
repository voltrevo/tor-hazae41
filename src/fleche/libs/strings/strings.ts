export namespace Strings {

  export function equalsIgnoreCase(a?: string | null, b?: string | null) {
    return a?.toLowerCase() === b?.toLowerCase()
  }

  export function splitOnFirst(text: string, splitter: string): [string, string] {
    const index = text.indexOf(splitter)

    const first = text.slice(0, index)
    const last = text.slice(index + splitter.length)

    return [first, last]
  }

}