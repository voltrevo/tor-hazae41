// See AbstractApp.md

import { assert } from './assert';

export type IAbstractApp<
  ComponentMap extends Record<
    string,
    { constructorParams: unknown[]; interface: unknown }
  >,
> = {
  /**
   * Create a new instance of a registered component.
   *
   * Throws if no constructor or class is registered for the component.
   */
  create<N extends keyof ComponentMap>(
    name: N,
    ...params: ComponentMap[N]['constructorParams']
  ): ComponentMap[N]['interface'];

  /**
   * Register a component constructor.
   *
   * Accepts either:
   *  - a class: `new (...params) => interface`
   *  - a factory function: `(...params) => interface`
   *
   * Overwrites any previous registration for the same name.
   */
  register<N extends keyof ComponentMap>(
    name: N,
    ctor:
      | ((
          ...params: ComponentMap[N]['constructorParams']
        ) => ComponentMap[N]['interface'])
      | (new (
          ...params: ComponentMap[N]['constructorParams']
        ) => ComponentMap[N]['interface'])
  ): void;

  /**
   * Retrieve a stored instance by component name and optional subname.
   *
   * Instances are keyed by (name, subname). If `subname` is omitted,
   * the `"default"` subname is used.
   *
   * Throws if no instance exists under the requested key.
   */
  get<N extends keyof ComponentMap>(
    name: N,
    subname?: string
  ): ComponentMap[N]['interface'];

  /**
   * Store an existing instance under (name, subname).
   *
   * Typically the instance will have been created via `create()`, but it can
   * come from anywhere as long as it matches the declared interface type.
   *
   * If `subname` is omitted, the instance is stored under the `"default"`
   * subname. Any previous instance at that key is overwritten.
   */
  set<N extends keyof ComponentMap>(
    name: N,
    instance: ComponentMap[N]['interface']
  ): void;
  set<N extends keyof ComponentMap>(
    name: N,
    subname: string,
    instance: ComponentMap[N]['interface']
  ): void;
};

type ComponentFactoryMap<
  ComponentMap extends Record<
    string,
    { constructorParams: unknown[]; interface: unknown }
  >,
> = {
  [K in keyof ComponentMap]: (
    ...args: ComponentMap[K]['constructorParams']
  ) => ComponentMap[K]['interface'];
};

type ComponentClassMap<
  ComponentMap extends Record<
    string,
    { constructorParams: unknown[]; interface: unknown }
  >,
> = {
  [K in keyof ComponentMap]: new (
    ...args: ComponentMap[K]['constructorParams']
  ) => ComponentMap[K]['interface'];
};

type ComponentCtorOrFactoryMap<
  ComponentMap extends Record<
    string,
    { constructorParams: unknown[]; interface: unknown }
  >,
> = {
  [K in keyof ComponentMap]:
    | ComponentFactoryMap<ComponentMap>[K]
    | ComponentClassMap<ComponentMap>[K];
};

/**
 * Creates and manages named component instances.
 *
 * - `register()` adds either a class or a factory function lazily.
 * - `create()` returns a fresh instance without storing it.
 * - `set()` stores an existing instance under (name, subname).
 * - `get()` retrieves a stored instance.
 */
export class AbstractApp<
  ComponentMap extends Record<
    string,
    { constructorParams: unknown[]; interface: unknown }
  >,
> implements IAbstractApp<ComponentMap> {
  /**
   * Map of registered constructors/classes for each component type.
   *
   * Populated via `register()`. Missing entries indicate components
   * that cannot currently be constructed.
   */
  private readonly constructors: Partial<
    ComponentCtorOrFactoryMap<ComponentMap>
  > = {};

  /**
   * Internal store of instances keyed by `"name::subname"`.
   */
  private readonly instances = new Map<string, unknown>();

  /**
   * Create an empty app.
   *
   * Use `register()` to add constructors before calling `create()`.
   */
  constructor() {}

  /** Build a stable string key from (name, subname). */
  private makeKey(name: keyof ComponentMap, subname?: string): string {
    return `${String(name)}::${subname ?? 'default'}`;
  }

  /**
   * Heuristic: treat “class” constructors differently from plain functions.
   * This avoids extra type gymnastics and keeps the runtime logic simple.
   */
  private isClassFunction(
    fn: unknown
  ): fn is new (...args: ExplicitAny[]) => ExplicitAny {
    return (
      typeof fn === 'function' &&
      /^class\s/.test(Function.prototype.toString.call(fn))
    );
  }

  register<N extends keyof ComponentMap>(
    name: N,
    ctor:
      | ((
          ...params: ComponentMap[N]['constructorParams']
        ) => ComponentMap[N]['interface'])
      | (new (
          ...params: ComponentMap[N]['constructorParams']
        ) => ComponentMap[N]['interface'])
  ): void {
    this.constructors[name] =
      ctor as ComponentCtorOrFactoryMap<ComponentMap>[N];
  }

  create<N extends keyof ComponentMap>(
    name: N,
    ...params: ComponentMap[N]['constructorParams']
  ): ComponentMap[N]['interface'] {
    const entry = this.constructors[name];
    if (!entry) {
      throw new Error(
        `No constructor registered for component "${String(name)}"`
      );
    }

    if (this.isClassFunction(entry)) {
      const Cls = entry as ComponentClassMap<ComponentMap>[N];
      return new Cls(...params);
    } else {
      const fn = entry as ComponentFactoryMap<ComponentMap>[N];
      return fn(...params);
    }
  }

  tryGet<N extends keyof ComponentMap>(
    name: N,
    subname?: string
  ): ComponentMap[N]['interface'] | undefined {
    const key = this.makeKey(name, subname);
    const instance = this.instances.get(key);

    return instance as ComponentMap[N]['interface'] | undefined;
  }

  get<N extends keyof ComponentMap>(
    name: N,
    subname?: string
  ): ComponentMap[N]['interface'] {
    const instance = this.tryGet(name, subname);

    assert(
      instance,
      `No instance registered for component "${String(name)}" with subname "${subname ?? 'default'}"`
    );

    return instance;
  }

  set<N extends keyof ComponentMap>(
    name: N,
    subnameOrInstance: string | ComponentMap[N]['interface'],
    maybeInstance?: ComponentMap[N]['interface']
  ): void {
    let subname: string | undefined;
    let instance: ComponentMap[N]['interface'];

    if (typeof subnameOrInstance === 'string') {
      subname = subnameOrInstance;
      if (maybeInstance === undefined) {
        throw new Error('set called without instance parameter');
      }
      instance = maybeInstance;
    } else {
      subname = undefined;
      instance = subnameOrInstance;
    }

    const key = this.makeKey(name, subname);
    this.instances.set(key, instance);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExplicitAny = any;
