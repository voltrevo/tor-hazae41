import { Bytes } from '../../../libs/bytes/index.js';

export async function hmacOrThrow(
  key: CryptoKey,
  seed: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, seed));
}

/**
 * Naive implementation, just for testing
 *
 * Could be improved using greedy or iteration
 * @param hash
 * @param secret
 * @param seed
 * @param index
 * @returns
 */
async function A(
  key: CryptoKey,
  seed: Uint8Array<ArrayBuffer>,
  index: number
): Promise<Uint8Array<ArrayBuffer>> {
  if (index === 0) return seed;

  const prev = await A(key, seed, index - 1);
  const hmac = await hmacOrThrow(key, prev);

  return hmac;
}

/**
 * Naive implementation, just for testing
 *
 * Could be improved using greedy
 * @param hash
 * @param secret
 * @param seed
 * @param length
 * @returns
 */
async function P(
  key: CryptoKey,
  seed: Uint8Array<ArrayBuffer>,
  length: number
): Promise<Uint8Array<ArrayBuffer>> {
  let result = new Uint8Array();

  for (let i = 1; result.length < length; i++)
    result = Bytes.concat(
      result,
      await hmacOrThrow(key, Bytes.concat(await A(key, seed, i), seed))
    );

  return result.subarray(0, length);
}

export async function prfOrThrow(
  hash: AlgorithmIdentifier,
  secret: Uint8Array<ArrayBuffer>,
  label: string,
  seed: Uint8Array<ArrayBuffer>,
  length: number
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash },
    false,
    ['sign']
  );
  const prf = await P(
    key,
    Bytes.concat(new TextEncoder().encode(label), seed),
    length
  );

  return prf;
}
