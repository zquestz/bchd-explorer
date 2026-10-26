/**
 * Copyright 2026 Josh Ellithorpe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Byte helpers that replace Node's Buffer, which browsers don't have.

// toHex returns bytes as lowercase hex, in the order given.
export function toHex(bytes) {
  return Array.from(bytes, (b) => (b & 0xff).toString(16).padStart(2, "0")).join("");
}

// fromHex returns the bytes of a hex string. Like Buffer.from(hex, "hex"),
// it stops at the first pair that isn't hex.
export function fromHex(hex) {
  const bytes = [];
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte) || !/^[0-9a-fA-F]{2}$/.test(hex.slice(i, i + 2))) {
      break;
    }
    bytes.push(byte);
  }
  return Uint8Array.from(bytes);
}

// toUtf8 decodes bytes as UTF-8 text.
export function toUtf8(bytes) {
  return new TextDecoder().decode(Uint8Array.from(bytes));
}
