import { GenericAEADCipher } from './aead/aead.js';
import { GenericBlockCipher } from './block/block.js';

export type GenericCipher = GenericBlockCipher | GenericAEADCipher;
