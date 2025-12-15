import { Log } from '../Log';
import type { IClock } from '../clock';
import type {
  ConsensusManager,
  ConsensusManagerOptions,
} from './ConsensusManager';
import type {
  MicrodescManager,
  MicrodescManagerOptions,
} from './MicrodescManager';
import type {
  CertificateManager,
  CertificateManagerOptions,
} from './CertificateManager';
import type { CircuitBuilder, CircuitBuilderOptions } from './CircuitBuilder';
import type { IStorage } from '../storage';
import type { CircuitManager } from './CircuitManager';
import { AbstractApp } from '../utils/AbstractApp';
import type { CCADB } from '../cadenas/mods/ccadb/CCADB';
import { type FetchCerts } from '../cadenas/mods/ccadb/fetchCerts';

type LogConstructorParams = ConstructorParameters<typeof Log>[0];

export type ComponentMap = {
  Clock: {
    constructorParams: [];
    interface: IClock;
  };
  Log: {
    constructorParams: [LogConstructorParams?];
    interface: Log;
  };
  ConsensusManager: {
    constructorParams: [ConsensusManagerOptions];
    interface: ConsensusManager;
  };
  MicrodescManager: {
    constructorParams: [MicrodescManagerOptions];
    interface: MicrodescManager;
  };
  CertificateManager: {
    constructorParams: [CertificateManagerOptions];
    interface: CertificateManager;
  };
  CircuitBuilder: {
    constructorParams: [CircuitBuilderOptions];
    interface: CircuitBuilder;
  };
  CircuitManager: {
    constructorParams: ConstructorParameters<typeof CircuitManager>;
    interface: CircuitManager;
  };
  Storage: {
    constructorParams: [];
    interface: IStorage;
  };
  ccadb: {
    constructorParams: never;
    interface: CCADB;
  };
  fetchCerts: {
    constructorParams: never;
    interface: FetchCerts;
  };
};

export class App extends AbstractApp<ComponentMap> {}
