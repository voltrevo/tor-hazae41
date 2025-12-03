export type IStorage = {
  read: (key: string) => Promise<Uint8Array>;
  write: (key: string, value: Uint8Array) => Promise<void>;
  list: (keyPrefix: string) => Promise<string[]>;
  remove: (key: string) => Promise<void>;
  removeAll: (keyPrefix?: string) => Promise<void>;
};

export {};
