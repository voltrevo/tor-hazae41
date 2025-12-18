import { Vector } from '../../../../../index.js';
import { Number16 } from '../../../numbers/number16.js';
import { Extension } from './extension.js';
import { ReadableVector } from '../../../vectors/readable.js';
import { ECPointFormats } from './ec_point_formats/ec_point_formats.js';
import { EllipticCurves } from './elliptic_curves/elliptic_curves.js';
import { ServerNameList } from './server_name/server_name_list.js';
import { SignatureAlgorithms } from './signature_algorithms/signature_algorithms.js';
import { Cursor } from '../../../../../../cursor/mod.js';
import { Unknown } from '../../../../../../binary/mod.js';
import { SafeUnknown } from '../../../../../../binary/safe-unknown/mod.js';

export type ResolvedExtension =
  | ServerNameList
  | SignatureAlgorithms
  | EllipticCurves
  | ECPointFormats
  | Unknown;

export namespace ResolvedExtension {
  function resolveOrThrow(
    type: number,
    cursor: Cursor
  ): Vector<Number16, ResolvedExtension> {
    // if (type === Extension.types.server_name)
    //   return ReadableVector(Number16, ServerNameList).readOrThrow(cursor)
    if (type === Extension.types.signature_algorithms)
      return ReadableVector(Number16, SignatureAlgorithms).readOrThrow(cursor);
    if (type === Extension.types.elliptic_curves)
      return ReadableVector(Number16, EllipticCurves).readOrThrow(cursor);
    if (type === Extension.types.ec_point_formats)
      return ReadableVector(Number16, ECPointFormats).readOrThrow(cursor);

    return ReadableVector(Number16, SafeUnknown).readOrThrow(cursor);
  }

  export function readOrThrow(cursor: Cursor): Extension<ResolvedExtension> {
    const type = cursor.readUint16OrThrow();
    const data = resolveOrThrow(type, cursor);

    return new Extension<ResolvedExtension>(type, data);
  }
}
