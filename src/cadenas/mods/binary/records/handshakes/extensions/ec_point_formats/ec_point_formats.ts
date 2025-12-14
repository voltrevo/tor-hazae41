import { Cursor } from '@hazae41/cursor';
import { ECPointFormatList } from '../../../../../../mods/binary/records/handshakes/extensions/ec_point_formats/ec_point_format_list.js';
import { Extension } from '../../../../../../mods/binary/records/handshakes/extensions/extension.js';

export class ECPointFormats {
  readonly #class = ECPointFormats;

  static readonly extension_type = Extension.types.ec_point_formats;

  constructor(readonly ec_point_format_list: ECPointFormatList) {}

  static new(ec_point_format_list: ECPointFormatList) {
    return new ECPointFormats(ec_point_format_list);
  }

  static default() {
    return new this(ECPointFormatList.default());
  }

  get extension_type() {
    return this.#class.extension_type;
  }

  sizeOrThrow() {
    return this.ec_point_format_list.sizeOrThrow();
  }

  writeOrThrow(cursor: Cursor) {
    this.ec_point_format_list.writeOrThrow(cursor);
  }

  static readOrThrow(cursor: Cursor) {
    return new ECPointFormats(ECPointFormatList.readOrThrow(cursor));
  }
}
