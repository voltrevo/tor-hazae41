export interface KeyExchange {
  readonly name: string;

  readonly ephemeral: boolean;
  readonly anonymous: boolean;
}
