import { Cursor } from '../../../../cursor';

export class HashAlgorithm {
  static readonly types = {
    none: 0,
    md5: 1,
    sha1: 2,
    sha224: 3,
    sha256: 4,
    sha384: 5,
    sha512: 6,
    intrinsic: 8,
  } as const;

  static readonly instances = {
    none: new HashAlgorithm(HashAlgorithm.types.none),
    md5: new HashAlgorithm(HashAlgorithm.types.md5),
    sha1: new HashAlgorithm(HashAlgorithm.types.sha1),
    sha224: new HashAlgorithm(HashAlgorithm.types.sha224),
    sha256: new HashAlgorithm(HashAlgorithm.types.sha256),
    sha384: new HashAlgorithm(HashAlgorithm.types.sha384),
    sha512: new HashAlgorithm(HashAlgorithm.types.sha512),
    intrinsic: new HashAlgorithm(HashAlgorithm.types.intrinsic),
  } as const;

  constructor(readonly type: number) {}

  static new(type: number) {
    return new HashAlgorithm(type);
  }

  sizeOrThrow() {
    return 1;
  }

  writeOrThrow(cursor: Cursor) {
    return cursor.writeUint8OrThrow(this.type);
  }

  static readOrThrow(cursor: Cursor) {
    return new HashAlgorithm(cursor.readUint8OrThrow());
  }
}
