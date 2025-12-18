export function bigModularExponent(
  base: bigint,
  exponent: bigint,
  modulus: bigint
): bigint {
  if (base <= 0n) throw new Error(`Invalid base`);
  if (exponent <= 0n) throw new Error(`Invalid exponent`);
  if (modulus <= 0n) throw new Error(`Invalid modulus`);

  if (modulus === 1n) return 0n;

  let result = 1n;

  while (exponent > 0) {
    if (exponent % 2n === 1n) result = (result * base) % modulus;

    exponent /= 2n;

    base = base ** 2n % modulus;
  }

  return result;
}
