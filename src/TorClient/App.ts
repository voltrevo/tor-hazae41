import { Log } from '../Log';
import type { IClock } from '../clock';
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
import { CircuitManager } from './CircuitManager';
import { AbstractApp } from '../utils/AbstractApp';

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
};

export class App extends AbstractApp<ComponentMap> {}
