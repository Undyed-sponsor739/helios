import type { MetricPoint } from "../store.js";

/**
 * TensorBoard event file parser.
 *
 * TensorBoard events are stored as serialized protobuf records in .tfevents files.
 * This parser handles the basic scalar summary format.
 *
 * TODO: Implement protobuf parsing with protobufjs
 * The event format is:
 *   - 8 bytes: data length (uint64 LE)
 *   - 4 bytes: CRC32 of length
 *   - N bytes: data (serialized Event protobuf)
 *   - 4 bytes: CRC32 of data
 */
export function parseTensorboardEvents(
  _buffer: Buffer,
): MetricPoint[] {
  // TODO: Implement with protobufjs
  // 1. Define Event, Summary, Value proto schemas
  // 2. Read tfrecord framing (length + crc + data + crc)
  // 3. Decode Event protobuf
  // 4. Extract scalar summaries
  return [];
}
