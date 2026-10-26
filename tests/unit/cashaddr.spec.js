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
import { fromTokenAware, toTokenAware } from "@/cashaddr";

// A P2SH32 address on mainnet and its token-aware form.
const P2SH32 =
  "bitcoincash:pv5q5j55gfdxjap3ddw2egda7shc50ffjhlv4v7kghcekw0cczvskzh4jmu5r";
const P2SH32_TOKEN_AWARE =
  "bitcoincash:rv5q5j55gfdxjap3ddw2egda7shc50ffjhlv4v7kghcekw0cczvsksyfnzadg";

describe("cashaddr", () => {
  it("converts to and from the token-aware form", () => {
    expect(toTokenAware(P2SH32)).toBe(P2SH32_TOKEN_AWARE);
    expect(fromTokenAware(P2SH32_TOKEN_AWARE)).toBe(P2SH32);
  });

  it("round trips addresses cashaddrjs-slp encodes", () => {
    for (const prefix of ["bitcoincash", "bchtest"]) {
      for (const type of ["P2PKH", "P2SH"]) {
        for (const length of [20, 32]) {
          for (let seed = 0; seed < 10; seed++) {
            const bytes = Uint8Array.from(
              { length },
              (_, i) => (i * 31 + seed * 17 + length) & 0xff
            );
            const standard = cashaddr.encode(prefix, type, bytes);
            const tokenAware = toTokenAware(standard);
            expect(tokenAware).not.toBe(null);
            expect(fromTokenAware(tokenAware)).toBe(standard);
          }
        }
      }
    }
  });

  it("accepts uppercase and prefixless token-aware addresses", () => {
    expect(fromTokenAware(P2SH32_TOKEN_AWARE.toUpperCase())).toBe(P2SH32);
    expect(fromTokenAware(P2SH32_TOKEN_AWARE.split(":")[1])).toBe(P2SH32);
  });

  it("rejects what isn't the expected form", () => {
    // Already standard, or already token-aware.
    expect(fromTokenAware(P2SH32)).toBe(null);
    expect(toTokenAware(P2SH32_TOKEN_AWARE)).toBe(null);
    // Bad checksum, mixed case, garbage.
    expect(fromTokenAware(P2SH32_TOKEN_AWARE.slice(0, -1) + "q")).toBe(null);
    expect(fromTokenAware("bitcoincash:Rv5q5j55" + P2SH32_TOKEN_AWARE.slice(20))).toBe(null);
    expect(fromTokenAware("bad")).toBe(null);
    expect(fromTokenAware(undefined)).toBe(null);
  });
});
