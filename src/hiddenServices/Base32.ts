export class Base32 {
  private static readonly ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

  static fromString(str: string): Uint8Array {
    const input = str.toLowerCase().replace(/=+$/, '');
    const bits = input.length * 5;
    const bytes = Math.floor(bits / 8);
    const data = new Uint8Array(bytes);

    let bitString = '';
    for (const char of input) {
      const index = this.ALPHABET.indexOf(char);
      if (index === -1) {
        throw new Error(`Invalid Base32 character: ${char}`);
      }
      bitString += index.toString(2).padStart(5, '0');
    }

    for (let i = 0; i < bytes; i++) {
      const byte = bitString.substring(i * 8, (i + 1) * 8);
      data[i] = parseInt(byte, 2);
    }

    return data;
  }

  static toString(data: Uint8Array): string {
    let bitString = '';
    for (const byte of data) {
      bitString += byte.toString(2).padStart(8, '0');
    }

    let result = '';
    for (let i = 0; i < bitString.length; i += 5) {
      const chunk = bitString.substring(i, i + 5).padEnd(5, '0');
      const index = parseInt(chunk, 2);
      result += this.ALPHABET[index];
    }

    return result;
  }
}
