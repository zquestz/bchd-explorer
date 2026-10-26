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

import cashaddr from "cashaddrjs-slp";
import { parseAddress } from "@/address";
import { fromHex, toHex, toUtf8 } from "@/hex";
import vectors from "./address-vectors.json";

// address-vectors.json holds addresses and conversions produced by
// bchaddrjs-slp, which parseAddress replaced, so the two must agree.

describe("parseAddress", () => {
  it("converts every format as bchaddrjs-slp did", () => {
    for (const v of vectors.vectors) {
      const parsed = parseAddress(v.cash);
      expect(parsed.cash).toBe(v.cash);
      expect(parsed.slp).toBe(v.slp);
      expect(parsed.legacy).toBe(v.legacy);
    }
  });

  it("accepts and rejects the inputs bchaddrjs-slp did", () => {
    for (const [input, cash] of vectors.inputs) {
      const parsed = parseAddress(input);
      // bchaddrjs-slp refused P2SH32 addresses in legacy form, which bchd
      // 0.22.3 accepts as BCHN does; parseAddress accepts them too.
      const legacyP2sh32 = vectors.vectors.find((v) => v.legacy === input && v.cash.length > 60);
      if (legacyP2sh32) {
        expect(parsed.cash).toBe(legacyP2sh32.cash);
        continue;
      }
      expect(parsed ? parsed.cash : null).toBe(cash);
    }
  });

  it("round trips addresses cashaddrjs-slp encodes", () => {
    for (const [prefix, network] of [["bitcoincash", "mainnet"], ["bchtest", "testnet"]]) {
      for (const type of ["P2PKH", "P2SH"]) {
        for (let seed = 0; seed < 25; seed++) {
          const hash = Uint8Array.from({ length: 20 }, (_, i) => (i * 37 + seed * 11) & 0xff);
          const cash = cashaddr.encode(prefix, type, hash);
          const parsed = parseAddress(cash);
          expect(parsed.network).toBe(network);
          expect(parseAddress(parsed.legacy).cash).toBe(cash);
          expect(parseAddress(parsed.slp).cash).toBe(cash);
        }
      }
    }
  });

  it("keeps leading zero bytes in legacy addresses", () => {
    const hash = new Uint8Array(20);
    const parsed = parseAddress(cashaddr.encode("bitcoincash", "P2PKH", hash));
    expect(parsed.legacy).toBe("1111111111111111111114oLvT2");
    expect(parseAddress(parsed.legacy).cash).toBe(parsed.cash);
  });

  it("leaves token-aware addresses to fromTokenAware", () => {
    const tokenAware = "bitcoincash:rv5q5j55gfdxjap3ddw2egda7shc50ffjhlv4v7kghcekw0cczvsksyfnzadg";
    expect(parseAddress(tokenAware)).toBe(null);
  });

  it("rejects what isn't an address", () => {
    for (const input of [undefined, null, 42, "", "1", "0OIl", "x".repeat(131)]) {
      expect(parseAddress(input)).toBe(null);
    }
  });
});

describe("hex helpers", () => {
  it("convert bytes and hex", () => {
    expect(toHex(Uint8Array.from([0, 1, 171, 255]))).toBe("0001abff");
    expect(Array.from(fromHex("0001abff"))).toEqual([0, 1, 171, 255]);
    // Like Buffer, stop at the first pair that isn't hex.
    expect(Array.from(fromHex("abzz12"))).toEqual([171]);
    expect(Array.from(fromHex("abc"))).toEqual([171]);
  });

  it("decode UTF-8", () => {
    expect(toUtf8(Uint8Array.from([0x68, 0x69, 0xe2, 0x82, 0xbf]))).toBe("hi\u20bf");
  });
});
