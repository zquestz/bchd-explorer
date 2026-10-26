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

// Bitcoin Cash address parsing across the formats the explorer accepts:
// cashaddr, SLP cashaddr (simpleledger:), legacy base58 and BitPay base58.
// Replaces bchaddrjs-slp, which needed Node's Buffer and stream modules.

import { sha256 } from "@noble/hashes/sha2.js";
import { decodeCashAddress, encodeCashAddress } from "./cashaddr";

const P2PKH = 0x00;
const P2SH = 0x08;

// Base58 version bytes by format, network and type.
const BASE58_VERSIONS = [
  { version: 0, network: "mainnet", type: P2PKH },
  { version: 5, network: "mainnet", type: P2SH },
  { version: 111, network: "testnet", type: P2PKH },
  { version: 196, network: "testnet", type: P2SH },
  // BitPay's old base58 versions, mainnet only.
  { version: 28, network: "mainnet", type: P2PKH },
  { version: 40, network: "mainnet", type: P2SH },
];
const LEGACY_VERSIONS = { mainnet: { [P2PKH]: 0, [P2SH]: 5 }, testnet: { [P2PKH]: 111, [P2SH]: 196 } };

const CASH_PREFIXES = { bitcoincash: "mainnet", bchtest: "testnet", regtest: "testnet", bchreg: "testnet" };
const SLP_PREFIXES = { simpleledger: "mainnet", slptest: "testnet", slpreg: "testnet" };
const CASH_PREFIX = { mainnet: "bitcoincash", testnet: "bchtest" };
const SLP_PREFIX = { mainnet: "simpleledger", testnet: "slptest" };

// The cashaddr version byte's size bits for each hash length.
const HASH_SIZE_BITS = { 20: 0, 24: 1, 28: 2, 32: 3, 40: 4, 48: 5, 56: 6, 64: 7 };

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function sha256d(bytes) {
  return sha256(sha256(bytes));
}

function base58Encode(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) {
    zeros++;
  }
  // Base 256 to base 58, least significant digit first.
  const digits = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return "1".repeat(zeros) + digits.reverse().map((d) => BASE58_ALPHABET[d]).join("");
}

// base58Decode returns the bytes of a base58 string, or null.
function base58Decode(text) {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") {
    zeros++;
  }
  const bytes = [];
  for (const ch of text) {
    let carry = BASE58_ALPHABET.indexOf(ch);
    if (carry < 0) {
      return null;
    }
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return Uint8Array.from([...new Array(zeros).fill(0), ...bytes.reverse()]);
}

function base58CheckEncode(payload) {
  const checksum = sha256d(payload).slice(0, 4);
  return base58Encode(Uint8Array.from([...payload, ...checksum]));
}

// base58CheckDecode returns the payload of a base58check string, or null.
function base58CheckDecode(text) {
  const bytes = base58Decode(text);
  if (!bytes || bytes.length < 5) {
    return null;
  }
  const payload = bytes.slice(0, -4);
  const checksum = sha256d(payload).slice(0, 4);
  return checksum.every((b, i) => b === bytes[bytes.length - 4 + i]) ? payload : null;
}

// decode returns { network, type, hash } for an address in any accepted
// format, or null.
function decode(input) {
  if (typeof input !== "string" || !input || input.length > 130) {
    return null;
  }
  const payload = base58CheckDecode(input);
  if (payload) {
    const known = BASE58_VERSIONS.find((v) => v.version === payload[0]);
    const hash = Array.from(payload.slice(1));
    // 20-byte hashes, plus P2SH32's 32-byte form, which bchd decodes as BCHN
    // does.
    if (known && (hash.length === 20 || (known.type === P2SH && hash.length === 32))) {
      return { network: known.network, type: known.type, hash };
    }
    return null;
  }
  for (const prefixes of [CASH_PREFIXES, SLP_PREFIXES]) {
    const decoded = decodeCashAddress(input, Object.keys(prefixes));
    if (decoded && decoded.prefix in prefixes) {
      const type = decoded.version & 0x78;
      if (type === P2PKH || type === P2SH) {
        return { network: prefixes[decoded.prefix], type, hash: decoded.hash };
      }
      return null;
    }
  }
  return null;
}

// parseAddress returns an address's cashaddr, SLP and legacy forms, or null
// when input is not a valid address. Token-aware cashaddrs are converted
// with fromTokenAware first.
export function parseAddress(input) {
  const decoded = decode(input);
  if (!decoded) {
    return null;
  }
  const { network, type, hash } = decoded;
  const version = type | (HASH_SIZE_BITS[hash.length] || 0);
  return {
    network,
    cash: encodeCashAddress(CASH_PREFIX[network], version, hash),
    slp: encodeCashAddress(SLP_PREFIX[network], version, hash),
    legacy: base58CheckEncode(Uint8Array.from([LEGACY_VERSIONS[network][type], ...hash])),
  };
}
