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

// Conversion between standard and token-aware (CashTokens) cashaddr forms.
// bchaddrjs-slp only knows the standard P2PKH and P2SH types, so token-aware
// addresses are converted here before it validates them.

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const PREFIXES = ["bitcoincash", "bchtest", "bchreg"];
// The 40-bit checksum generators as [high 8 bits, low 32 bits]. The
// toolchain (webpack 4, ESLint 5) predates BigInt, so checksums are computed
// in two halves.
const GENERATORS = [
  [0x98, 0xf2bc8e61],
  [0x79, 0xb76d99e2],
  [0xf3, 0x3e5fb3c4],
  [0xae, 0x2eabe2a8],
  [0x1e, 0x4f43e470],
];
// Version byte type bits: 0x00 P2PKH, 0x08 P2SH, plus 0x10 when token-aware.
const TYPE_MASK = 0x78;
const TOKEN_AWARE_BIT = 0x10;

// polymod returns the cashaddr checksum of values as a Number (40 bits).
function polymod(values) {
  let hi = 0;
  let lo = 1;
  for (const value of values) {
    const c0 = hi >>> 3;
    hi = ((hi & 0x07) << 5) | (lo >>> 27);
    lo = (((lo << 5) >>> 0) ^ value) >>> 0;
    for (let i = 0; i < GENERATORS.length; i++) {
      if ((c0 >>> i) & 1) {
        hi ^= GENERATORS[i][0];
        lo = (lo ^ GENERATORS[i][1]) >>> 0;
      }
    }
  }
  return hi * 0x100000000 + ((lo ^ 1) >>> 0);
}

function prefixWords(prefix) {
  return Array.from(prefix, (ch) => ch.charCodeAt(0) & 31);
}

function convertBits(data, from, to, pad) {
  let acc = 0;
  let bits = 0;
  const out = [];
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & ((1 << to) - 1));
    }
  }
  if (pad && bits > 0) {
    out.push((acc << (to - bits)) & ((1 << to) - 1));
  }
  return out;
}

// decode returns { prefix, version, hash } for a valid cashaddr, with or
// without its prefix, or null.
function decode(address) {
  if (typeof address !== "string" || address.length > 130) {
    return null;
  }
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    return null;
  }
  const lower = address.toLowerCase();
  const parts = lower.split(":");
  if (parts.length > 2) {
    return null;
  }
  const payloadText = parts[parts.length - 1];
  const words = Array.from(payloadText, (ch) => CHARSET.indexOf(ch));
  if (words.length < 9 || words.includes(-1)) {
    return null;
  }
  const prefixes = parts.length === 2 ? [parts[0]] : PREFIXES;
  for (const prefix of prefixes) {
    if (polymod([...prefixWords(prefix), 0, ...words]) !== 0) {
      continue;
    }
    const bytes = convertBits(words.slice(0, -8), 5, 8, false);
    if (bytes.length < 21) {
      return null;
    }
    return { prefix, version: bytes[0], hash: bytes.slice(1) };
  }
  return null;
}

function encode(prefix, version, hash) {
  const payload = convertBits([version, ...hash], 8, 5, true);
  const checksum = polymod([
    ...prefixWords(prefix),
    0,
    ...payload,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
  const checksumWords = [];
  for (let i = 0; i < 8; i++) {
    checksumWords.push(Math.floor(checksum / 2 ** (5 * (7 - i))) % 32);
  }
  return (
    prefix +
    ":" +
    [...payload, ...checksumWords].map((w) => CHARSET[w]).join("")
  );
}

// fromTokenAware returns the standard cashaddr for a token-aware address, or
// null when address is not a valid token-aware cashaddr.
export function fromTokenAware(address) {
  const decoded = decode(address);
  if (!decoded || !(decoded.version & TOKEN_AWARE_BIT)) {
    return null;
  }
  const type = decoded.version & TYPE_MASK;
  if (type !== 0x10 && type !== 0x18) {
    return null;
  }
  return encode(
    decoded.prefix,
    decoded.version & ~TOKEN_AWARE_BIT,
    decoded.hash
  );
}

// toTokenAware returns the token-aware form of a standard P2PKH or P2SH
// cashaddr, or null when address is not one.
export function toTokenAware(address) {
  const decoded = decode(address);
  if (!decoded) {
    return null;
  }
  const type = decoded.version & TYPE_MASK;
  if (type !== 0x00 && type !== 0x08) {
    return null;
  }
  return encode(
    decoded.prefix,
    decoded.version | TOKEN_AWARE_BIT,
    decoded.hash
  );
}
