import { Factory } from '../utils/Factory';
import { Log } from '../Log';
import type { IClock } from '../clock';
import { SystemClock } from '../clock';
import {
  ConsensusManager,
  type ConsensusManagerOptions,
} from './ConsensusManager';
import {
  MicrodescManager,
  type MicrodescManagerOptions,
} from './MicrodescManager';
import {
  CertificateManager,
  type CertificateManagerOptions,
} from './CertificateManager';
import { CircuitBuilder, type CircuitBuilderOptions } from './CircuitBuilder';
import type { IStorage } from '../storage';

type LogConstructorParams = ConstructorParameters<typeof Log>[0];

export type TorClientComponentMap = {
  clock: {
    constructorParams: [];
    interface: IClock;
  };
  log: {
    constructorParams: [LogConstructorParams?];
    interface: Log;
  };
  consensusManager: {
    constructorParams: [ConsensusManagerOptions];
    interface: ConsensusManager;
  };
  microdescManager: {
    constructorParams: [MicrodescManagerOptions];
    interface: MicrodescManager;
  };
  certificateManager: {
    constructorParams: [CertificateManagerOptions];
    interface: CertificateManager;
  };
  circuitBuilder: {
    constructorParams: [CircuitBuilderOptions];
    interface: CircuitBuilder;
  };
  // Context items
  storage: {
    constructorParams: [];
    interface: IStorage;
  };
};

export interface TorClientFactoryOptions {
  clock?: IClock;
  log?: Log;
  storage?: IStorage;
}

export function createTorClientFactory(
  options: TorClientFactoryOptions = {}
): Factory<TorClientComponentMap> {
  const factory = new Factory<TorClientComponentMap>();

  factory.register('clock', () => options.clock ?? new SystemClock());
  factory.register('log', params => options.log ?? new Log(params));

  // Register manager factories
  factory.register('certificateManager', opts => new CertificateManager(opts));
  factory.register('microdescManager', opts => new MicrodescManager(opts));
  factory.register('consensusManager', opts => new ConsensusManager(opts));
  factory.register('circuitBuilder', opts => new CircuitBuilder(opts));

  // Store context values using the factory's instance storage
  if (options.storage) {
    factory.set('storage', options.storage);
  }

  return factory;
}
