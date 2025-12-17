import { Bytes } from '../hazae41/bytes';

export type IStorage = {
  read: (key: string) => Promise<Bytes>;
  write: (key: string, value: Bytes) => Promise<void>;
  list: (keyPrefix: string) => Promise<string[]>;
  remove: (key: string) => Promise<void>;
  removeAll: (keyPrefix?: string) => Promise<void>;
};

export {};
