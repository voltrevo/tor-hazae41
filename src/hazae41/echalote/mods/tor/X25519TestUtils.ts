/**
 * X25519 Test Utilities
 *
 * Type definitions for X25519 performance tests
 */

export interface X25519OperationInput {
  key?: string;
  public_key?: string;
}

export interface X25519OperationOutput {
  public_key?: string;
  shared_secret?: string;
  key?: string;
  secret?: string;
}

export interface X25519Operation {
  operation: string;
  timestamp: string;
  duration: number;
  input?: X25519OperationInput;
  output?: X25519OperationOutput;
}
