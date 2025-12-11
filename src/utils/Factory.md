# `Factory` – Typed Component Factory

A small, strongly-typed factory for creating and managing named component instances.

It’s built around a `ComponentMap` that describes each component’s constructor parameters and public interface.

---

## ComponentMap

```ts
type ComponentMap = {
  logger: {
    constructorParams: [level: 'debug' | 'info' | 'warn' | 'error'];
    interface: Logger;
  };
  httpClient: {
    constructorParams: [baseUrl: string];
    interface: HttpClient;
  };
};
```

- `constructorParams`: tuple of arguments passed into `create`.
- `interface`: the runtime shape you care about (usually a class instance or an interface).

---

## API Overview

```ts
export interface IFactory<ComponentMap> {
  create<N extends keyof ComponentMap>(
    name: N,
    ...params: ComponentMap[N]['constructorParams']
  ): ComponentMap[N]['interface'];

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

  get<N extends keyof ComponentMap>(
    name: N,
    subname?: string
  ): ComponentMap[N]['interface'];

  set<N extends keyof ComponentMap>(
    name: N,
    instance: ComponentMap[N]['interface']
  ): void;
  set<N extends keyof ComponentMap>(
    name: N,
    subname: string,
    instance: ComponentMap[N]['interface']
  ): void;
}
```

### Semantics

- **`register(name, ctor)`**
  - Register either a _class_ (`new (...) => T`) or a _factory function_ (`(...) => T`).
  - Overwrites any previous registration for the same `name`.
  - Must be called before `create(name, ...)`.

- **`create(name, ...params)`**
  - Calls the registered ctor/class with the given parameters.
  - **Does not** store the instance.
  - Throws if there is no registration for `name`.

- **`set(name, instance)` / `set(name, subname, instance)`**
  - Stores an existing instance under `(name, subname)`.
  - If `subname` is omitted, `"default"` is used.
  - Overwrites any existing instance at that key.

- **`get(name, subname?)`**
  - Returns the instance stored for `(name, subname)`.
  - If `subname` is omitted, `"default"` is used.
  - Throws if no instance is stored for that key.

---

## Basic Usage

```ts
class Logger {
  constructor(public level: 'debug' | 'info' | 'warn' | 'error') {}
  log(msg: string) {
    /* ... */
  }
}

class HttpClient {
  constructor(public baseUrl: string) {}
  get(path: string) {
    /* ... */
  }
}

type Components = {
  logger: {
    constructorParams: [level: 'debug' | 'info' | 'warn' | 'error'];
    interface: Logger;
  };
  httpClient: {
    constructorParams: [baseUrl: string];
    interface: HttpClient;
  };
};

const factory = new Factory<Components>();

// Register using a class
factory.register('logger', Logger);

// Or using a factory function
factory.register('httpClient', (baseUrl: string) => new HttpClient(baseUrl));

// Construct instances (not stored yet)
const logger = factory.create('logger', 'info');
const apiClient = factory.create('httpClient', 'https://api.example.com');

// Store instances
factory.set('logger', logger); // default logger
factory.set('httpClient', 'primary', apiClient); // named client

// Retrieve instances later
const defaultLogger = factory.get('logger');
const primaryClient = factory.get('httpClient', 'primary');
```

---

## Subnames

Subnames let you hold multiple instances of the same component type:

```ts
factory.set(
  'httpClient',
  'primary',
  factory.create('httpClient', 'https://api.example.com')
);
factory.set(
  'httpClient',
  'secondary',
  factory.create('httpClient', 'https://backup.example.com')
);

const primary = factory.get('httpClient', 'primary');
const secondary = factory.get('httpClient', 'secondary');
```

If you don’t care about multiple instances, just rely on the `"default"` subname (omit it in `set` / `get`).

---

## Type Safety Notes

- The compiler enforces:
  - valid `name` keys,
  - correct parameter lists per component,
  - correct instance type per component.
- At runtime:
  - `create` throws if you forgot to `register` a component.
  - `get` throws if you ask for an instance that hasn’t been `set`.

This keeps the implementation small while still giving you a strongly typed mini DI container.

## TorClient Integration

`TorClient` now constructs its base helpers through `src/TorClient/factory.ts`, which exposes `createTorClientFactory`. That factory registers `log` and `clock`, ensuring the client always receives the same instances (or allows swapping them out via the factory options), while downstream managers keep using fields like `this.log` and `this.clock` as before.
