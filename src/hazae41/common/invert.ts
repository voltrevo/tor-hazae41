export type Inverted<T extends Record<PropertyKey, PropertyKey>> = {
  [K in keyof T as T[K]]: K;
};

export function invert<T extends Record<PropertyKey, PropertyKey>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).map(([k, v]) => [v, k])
  ) as Inverted<T>;
}
