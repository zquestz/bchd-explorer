/**
 * Copyright 2020 Coinbase, Inc.
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

import BCHDExplorer from "@/components/BCHDExplorer.vue";
import { mount, createLocalVue } from "@vue/test-utils";
import VueRouter from "vue-router";
import {
  addressTransactions,
  block,
  blockchainInfo,
  doubleSpendProofs,
  fakeClient,
  grpcError,
  hexHash,
  mempoolInfo,
  transaction,
  transactionResponse,
  unspentOutputs,
} from "./fixtures";

const Code = { Unknown: 2, NotFound: 5, ResourceExhausted: 8, Aborted: 10, Unavailable: 14 };

const ROUTES = [
  { name: "home", path: "/" },
  { name: "address", path: "/:network/address/:address" },
  { name: "block", path: "/:network/block/:blockHash" },
  { name: "tx", path: "/:network/tx/:txId" },
];

const ADDRESS = "qqm3qwahv44xz4vyrv9nh46xwsha6eqzdgv2taxj2j";
const P2SH32 = "bitcoincash:pv5q5j55gfdxjap3ddw2egda7shc50ffjhlv4v7kghcekw0cczvskzh4jmu5r";
const P2SH32_TOKEN_AWARE = "bitcoincash:rv5q5j55gfdxjap3ddw2egda7shc50ffjhlv4v7kghcekw0cczvsksyfnzadg";
const TXID = hexHash(0xabc);
const CATEGORY = hexHash(0xca7);

function mountExplorer({ client = fakeClient(), path = "/" } = {}) {
  const localVue = createLocalVue();
  localVue.use(VueRouter);
  const router = new VueRouter({ mode: "abstract", routes: ROUTES });
  router.push(path);
  const wrapper = mount(BCHDExplorer, {
    localVue,
    router,
    data() {
      return { getInfoBar: false };
    },
    methods: { newGrpcClient: () => client },
  });
  return { wrapper, client, router };
}

// settle lets the fake client's promises and Vue's updates run.
async function settle(rounds = 10) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// cell returns the value cell of the row labelled label, or null. Hidden
// result tables stay in the page, so scope it when labels repeat.
function cell(wrapper, label) {
  const rows = wrapper
    .findAll("tr")
    .filter((r) => r.findAll("td").length === 2 && r.findAll("td").at(0).text() === label);
  return rows.length ? rows.at(0).findAll("td").at(1) : null;
}

function confirmedTx(overrides = {}) {
  return transaction({
    txid: TXID,
    height: 900,
    confirmations: 101,
    timestamp: 1700000000,
    size: 250,
    inputs: [{ prev: hexHash(0x111), vout: 1, value: 10000, address: ADDRESS }],
    outputs: [
      {
        value: 9000,
        address: "qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a",
        asm: "OP_DUP OP_HASH160 abcd OP_EQUALVERIFY OP_CHECKSIG",
        cashToken: { category: CATEGORY, amount: "18446744073709551615", bitfield: 0x10 },
      },
    ],
    ...overrides,
  });
}

describe("BCHDExplorer.vue searching", () => {
  it("reports when nothing is found", async () => {
    const { wrapper } = mountExplorer();
    await settle();
    await wrapper.vm.searchBCHD("bad");
    expect(wrapper.vm.result).toBe("No address, transaction or block hash/height found.");
  });

  it("finds a block by height and lists its transactions", async () => {
    const client = fakeClient({
      getBlock: (q) => block({ height: q.index, next: hexHash(q.index + 1), txids: [hexHash(1), hexHash(2)] }),
    });
    const { wrapper, router } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD("  632707\n");
    await settle();
    expect(router.currentRoute.path).toBe("/mainnet/block/632707");
    expect(wrapper.vm.blockData.height).toBe(632707);
    expect(wrapper.vm.blockData.transaction_count).toBe(2);
    expect(wrapper.findAll("#bchablock a").filter((a) => a.attributes("href") === `/mainnet/tx/${hexHash(2)}`).length).toBe(1);
    expect(document.title).toBe("Block 632707 \u00b7 BCHD Explorer");
  });

  it("pages a large block's transactions with their positions", async () => {
    const txids = (height, count) => Array.from({ length: count }, (_, i) => hexHash(height * 100000 + i));
    const client = fakeClient({
      getBlock: (q) => block({ height: q.index, next: hexHash(q.index + 1), txids: txids(q.index, q.index === 7 ? 1234 : 60) }),
    });
    const { wrapper } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD("7");
    await settle();
    const section = () => wrapper.find(".block-transactions");
    const indexes = () => section().findAll("tbody tr").wrappers.map((r) => r.findAll("td").at(0).text());
    // No cap: every transaction is reachable.
    expect(section().find("h2").text()).toBe("1234 Transactions");
    expect(section().find(".pager").text()).toContain("Page 1 of 25");
    expect(section().findAll("th").wrappers.map((th) => th.text())).toEqual(["Index", "Transaction"]);
    expect(indexes()[0]).toBe("0 (coinbase)");
    expect(indexes()[49]).toBe("49");

    // Each click needs a render, as the pager asks for its current page + 1.
    const next = async () => {
      section().findAll(".pager a").filter((a) => a.text().includes("Next")).at(0).trigger("click");
      await settle(1);
    };
    await next();
    await next();
    // Page 3 starts at position 100, and links that transaction.
    expect(section().find(".pager").text()).toContain("Page 3 of 25");
    expect(indexes()[0]).toBe("100");
    expect(section().find("tbody a").attributes("href")).toBe(`/mainnet/tx/${txids(7, 1234)[100]}`);

    // The last page holds the remainder.
    for (let i = 0; i < 22; i++) {
      await next();
    }
    expect(indexes()).toEqual(["1200", ...Array.from({ length: 33 }, (_, i) => String(1201 + i))]);

    // Another block starts on its first page.
    await wrapper.vm.searchBCHD("8");
    await settle();
    expect(section().find(".pager").text()).toContain("Page 1 of 2");
    expect(indexes()[0]).toBe("0 (coinbase)");
  });

  it("shows a transaction with its fee, script and CashTokens", async () => {
    const client = fakeClient({ getTransaction: () => transactionResponse(confirmedTx()) });
    const { wrapper } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD(TXID);
    await settle();
    expect(cell(wrapper, "Fee").text()).toBe("1000 satoshis (4.00 sat/B)");
    expect(cell(wrapper, "Pubkey Script (ASM)").text()).toBe("OP_DUP OP_HASH160 abcd OP_EQUALVERIFY OP_CHECKSIG");
    expect(cell(wrapper, "CashToken Category").text()).toBe(CATEGORY);
    expect(cell(wrapper, "CashToken Amount").text()).toBe("18446744073709551615");
    expect(cell(wrapper.find("#bchtransaction"), "Timestamp").text()).toMatch(/^2023-11-14 22:13:20 UTC \(/);
    expect(cell(wrapper, "Block Height").find("a").attributes("href")).toBe("/mainnet/block/900");
    expect(cell(wrapper, "Outpoint Hash").find("a").attributes("href")).toBe(`/mainnet/tx/${hexHash(0x111)}`);
    expect(document.title).toBe(`Transaction ${TXID.slice(0, 10)}\u2026 \u00b7 BCHD Explorer`);
  });

  it("parses NFT capabilities and totals CashTokens by category", () => {
    const { wrapper } = mountExplorer();
    const parse = (bitfield, amount, commitment) => wrapper.vm.parseCashToken({
      getBitfield_asU8: () => Uint8Array.from([bitfield]),
      getCategoryId_asU8: () => Uint8Array.from(Buffer.from(CATEGORY, "hex").reverse()),
      getAmount: () => amount,
      getCommitment_asU8: () => Uint8Array.from(Buffer.from(commitment || "", "hex")),
    });
    const tokens = [parse(0x72, "5", "cafe"), parse(0x21), parse(0x60, undefined, "01")];
    expect(tokens.map((t) => t.nft.capability)).toEqual(["minting", "mutable", "immutable"]);
    expect(tokens[0].nft.commitment).toBe("cafe");
    const [summary] = wrapper.vm.summarizeCashTokens(tokens.concat([undefined]));
    expect(summary.amount.toFixed()).toBe("5");
    expect(summary.nfts).toBe(3);
    expect(summary.capabilities).toEqual({ immutable: 1, mutable: 1, minting: 1 });
  });

  it("leaves coinbase inputs and unconfirmed blocks unlinked", async () => {
    const coinbase = transaction({
      txid: TXID,
      inputs: [{ prev: hexHash(0) }],
      outputs: [{ value: 625000000, address: ADDRESS }],
    });
    const client = fakeClient({ getTransaction: () => transactionResponse(coinbase) });
    const { wrapper } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD(TXID);
    await settle();
    expect(wrapper.vm.transactionData.fee).toBe(null);
    expect(cell(wrapper, "Outpoint Hash").find("a").exists()).toBe(false);
    expect(cell(wrapper, "Block Height").find("a").exists()).toBe(false);
    expect(cell(wrapper.find("#bchtransaction"), "Timestamp").text()).toBe("Not yet in a block");
  });

  it("shows double spend proof results for unconfirmed transactions", async () => {
    const unconfirmed = confirmedTx({ confirmations: 0 });
    const client = fakeClient({ getTransaction: () => transactionResponse(unconfirmed) });
    const { wrapper } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD(TXID);
    await settle();
    expect(cell(wrapper, "Double Spend Proof Score").text()).toBe("1 (no double spend seen, and every input can get a proof)");
    expect(cell(wrapper, "Double Spend Proof").text()).toBe("None");
  });

  it("looks up token-aware addresses by their standard form", async () => {
    const client = fakeClient();
    const { wrapper, router } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD(P2SH32_TOKEN_AWARE);
    await settle();
    const queried = client.calls.filter((c) => c.method === "getAddressUtxos").map((c) => c.query.address);
    expect(queried).toEqual([P2SH32]);
    expect(wrapper.vm.addressData.token_aware).toBe(P2SH32_TOKEN_AWARE);
    expect(router.currentRoute.params.address).toBe(P2SH32_TOKEN_AWARE);
  });

  it("lists an address's transactions and unspent outputs", async () => {
    const spend = transaction({
      txid: hexHash(3), height: 903, confirmations: 1, timestamp: 1700001800,
      inputs: [{ prev: hexHash(1), value: 5000, address: ADDRESS }],
      outputs: [{ value: 3000, address: "qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a" }, { value: 1500, address: ADDRESS }],
    });
    const receive = transaction({
      txid: hexHash(1), height: 901, confirmations: 3, timestamp: 1700000600,
      inputs: [{ prev: hexHash(9), value: 6000, address: "qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a" }],
      outputs: [{ value: 5000, address: ADDRESS }],
    });
    const pending = transaction({
      txid: hexHash(4),
      inputs: [{ prev: hexHash(8), value: 900, address: "qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a" }],
      outputs: [{ value: 700, address: ADDRESS }],
    });
    const client = fakeClient({
      getAddressTransactions: () => addressTransactions({ confirmed: [spend, receive], unconfirmed: [{ tx: pending, addedTime: 1700002000 }] }),
      getAddressUtxos: () => unspentOutputs([
        { txid: hexHash(3), vout: 1, value: 1500, height: 903 },
        { txid: hexHash(4), vout: 0, value: 700, height: 0x7fffffff, cashToken: { category: CATEGORY, bitfield: 0x22 } },
      ]),
    });
    const { wrapper } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD("bitcoincash:" + ADDRESS);
    await settle();
    const list = wrapper.vm.addressData.transaction_list;
    expect(list.map((t) => [t.txid, t.height, t.net])).toEqual([
      [hexHash(4), null, 700],
      [hexHash(3), 903, -3500],
      [hexHash(1), 901, 5000],
    ]);
    // With the full history listed, the changes add up to the balance.
    expect(list.reduce((sum, t) => sum + t.net, 0)).toBe(wrapper.vm.addressData.satoshis);
    const utxos = wrapper.vm.addressData.utxo_list;
    expect(utxos.map((u) => [u.vout, u.height])).toEqual([[0, null], [1, 903]]);
    expect(wrapper.text()).toContain("CashToken NFT (minting)");
    expect(wrapper.text()).toContain("+0.000007 BCH");
    expect(wrapper.text()).toContain("-0.000035 BCH");
    expect(document.title).toBe(`Address ${ADDRESS.slice(0, 10)}\u2026 \u00b7 BCHD Explorer`);
  });

  it("pages long address lists and notes bchd's cap", async () => {
    const many = [];
    for (let i = 0; i < 10000; i++) {
      many.push(transaction({ txid: hexHash(0x100000 + i), height: 50000 - i, confirmations: 1 + i, timestamp: 1700000000 }));
    }
    const client = fakeClient({ getAddressTransactions: () => addressTransactions({ confirmed: many }) });
    const { wrapper } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD("bitcoincash:" + ADDRESS);
    await settle();
    expect(wrapper.vm.addressData.confirmed_transactions).toBe("10000+");
    expect(wrapper.text()).toContain("Only the newest 10000 confirmed transactions are listed.");
    expect(wrapper.find(".pager").text()).toContain("Page 1 of 200");
    wrapper.find(".pager a").trigger("click");
    await settle(2);
    expect(wrapper.find(".pager").text()).toContain("Page 2 of 200");
  });
});

describe("BCHDExplorer.vue node errors", () => {
  it("retries an address lookup the node aborted for a reorg", async () => {
    let attempts = 0;
    const client = fakeClient({
      getAddressUtxos: () => {
        attempts++;
        if (attempts === 1) {
          throw grpcError(Code.Aborted, "chain reorganized");
        }
        return unspentOutputs([]);
      },
    });
    const { wrapper } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD("bitcoincash:" + ADDRESS);
    expect(attempts).toBe(2);
    expect(wrapper.vm.result).toBe("");
  });

  it("explains missing indexes, limits and unreachable nodes", async () => {
    const cases = [
      [{ getAddressUtxos: () => { throw grpcError(Code.Unavailable, "addrindex required"); } }, "bitcoincash:" + ADDRESS,
        "This node runs without an address index (--addrindex), so it can't look up addresses."],
      [{ getTransaction: () => { throw grpcError(Code.Unavailable, "txindex required"); } }, TXID,
        "This node runs without a transaction index (--txindex), so it can't look up transactions."],
      [{ getTransaction: () => { throw grpcError(Code.ResourceExhausted, "too many calls"); } }, TXID,
        "The node is busy (a request limit was reached). Try again shortly."],
      [{ getTransaction: () => { throw grpcError(Code.Unknown, "Response closed without headers"); } }, TXID,
        "Couldn't reach the node: Response closed without headers"],
    ];
    for (const [handlers, input, message] of cases) {
      const { wrapper } = mountExplorer({ client: fakeClient(handlers) });
      await settle();
      await wrapper.vm.searchBCHD(input);
      expect(wrapper.vm.result).toBe(message);
    }
  });

  it("doesn't ask a node without an SLP index for token metadata", async () => {
    const client = fakeClient({
      getBlockchainInfo: () => blockchainInfo({ slpIndex: false }),
      getTransaction: () => transactionResponse(confirmedTx()),
    });
    const { wrapper } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD(TXID);
    await wrapper.vm.searchBCHD("bitcoincash:" + ADDRESS);
    const flags = client.calls.filter((c) => ["getTransaction", "getAddressUtxos"].includes(c.method)).map((c) => c.query.includeTokenMetadata);
    expect(flags).toEqual([false, false]);
  });
});

describe("BCHDExplorer.vue navigation", () => {
  function blockClient(tip = 1000) {
    return fakeClient({
      getBlockchainInfo: () => blockchainInfo({ height: tip, tipHash: hexHash(tip) }),
      getBlock: (q) => {
        const height = q.index !== undefined ? q.index : parseInt(q.hash, 16);
        if (height > tip) {
          throw grpcError(Code.NotFound, "block not found");
        }
        return block({ height, next: height < tip ? hexHash(height + 1) : "" });
      },
    });
  }

  it("links previous and next blocks, except past either end", async () => {
    const { wrapper } = mountExplorer({ client: blockClient(), path: "/mainnet/block/500" });
    await settle();
    const nav = () => wrapper.find(".block-nav");
    expect(nav().findAll("a").wrappers.map((a) => a.attributes("href"))).toEqual(["/mainnet/block/499", "/mainnet/block/501"]);

    await wrapper.vm.searchBCHD("0");
    await settle();
    expect(nav().findAll("a").wrappers.map((a) => a.text())).toEqual(["Next \u2192"]);

    await wrapper.vm.searchBCHD("1000");
    await settle();
    expect(nav().findAll("a").wrappers.map((a) => a.text())).toEqual(["\u2190 Previous"]);
  });

  it("links the status line to the newest block", async () => {
    const { wrapper } = mountExplorer({ client: blockClient() });
    await settle();
    const hrefs = wrapper.find(".info-result").findAll("a").wrappers.map((a) => a.attributes("href"));
    expect(hrefs).toEqual(["/mainnet/block/1000", `/mainnet/block/${hexHash(1000)}`]);
  });

  it("follows back and forward without refetching its own pushes", async () => {
    const client = blockClient();
    client.getTransaction = (q) => {
      client.calls.push({ method: "getTransaction", query: q });
      return Promise.resolve(transactionResponse(confirmedTx()));
    };
    const { wrapper, router } = mountExplorer({ client });
    // Let the home page's recent blocks finish loading first.
    await settle(40);
    const before = client.count("getBlock");
    await wrapper.vm.searchBCHD("500");
    await settle();
    // One lookup for the search; none for the route it pushed.
    expect(client.count("getBlock") - before).toBe(1);

    await wrapper.vm.searchBCHD(TXID);
    await settle();
    expect(wrapper.vm.transaction).toBe(TXID);

    router.back();
    await settle();
    expect(wrapper.vm.blockData.height).toBe(500);
    expect(wrapper.vm.input).toBe("500");

    router.forward();
    await settle();
    expect(wrapper.vm.transaction).toBe(TXID);

    router.go(-2);
    await settle();
    expect(router.currentRoute.path).toBe("/");
    expect(wrapper.vm.transaction).toBe("");
    expect(wrapper.vm.input).toBe("");
  });

  it("goes home from the logo", async () => {
    const { wrapper, router } = mountExplorer({ client: blockClient(), path: "/mainnet/block/500" });
    await settle();
    // A cancellable click, as browsers send; vue-router cancels its default.
    wrapper.find(".logo-link").element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    );
    await settle();
    expect(router.currentRoute.path).toBe("/");
    expect(wrapper.vm.block).toBe("");
    expect(document.title).toBe("BCHD Explorer");
  });

  it("opens links on a server for their network", async () => {
    const testnet = fakeClient({ getBlockchainInfo: () => blockchainInfo({ net: 4 }) });
    for (const path of ["/testnet4/block/1", "/testnet3/block/1"]) {
      const { wrapper } = mountExplorer({ client: testnet, path });
      await settle();
      expect(wrapper.vm.selectedNetwork).toBe("https://bchd-testnet.greyh.at:18335");
      expect(wrapper.vm.network).toBe("testnet4");
    }
  });

  it("ignores a search that finishes after a newer one started", async () => {
    let release;
    const client = blockClient();
    const fast = client.getBlock;
    client.getBlock = (q) => {
      if (q.index === 777) {
        return new Promise((resolve) => { release = () => resolve(block({ height: 777 })); });
      }
      return fast(q);
    };
    const { wrapper, router } = mountExplorer({ client });
    await settle();
    await wrapper.vm.searchBCHD("500");
    await settle();
    const slow = wrapper.vm.searchBCHD("777");
    await settle();
    await wrapper.vm.searchBCHD("600");
    await settle();
    release();
    await slow;
    await settle();
    expect(router.currentRoute.path).toBe("/mainnet/block/600");
    expect(wrapper.vm.blockData.height).toBe(600);
  });
});

// deferred returns a promise with its resolve and reject exposed.
function deferred() {
  const d = {};
  d.promise = new Promise((resolve, reject) => {
    d.resolve = resolve;
    d.reject = reject;
  });
  return d;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// mempoolCells returns the home page mempool table's header and row texts.
function mempoolCells(wrapper) {
  return wrapper.findAll("#mempoolstats tr").wrappers.map((r) => r.findAll("th, td").wrappers.map((c) => c.text()));
}

function statusTexts(wrapper) {
  return wrapper.findAll("[role=status]").wrappers.map((s) => s.text());
}

describe("BCHDExplorer.vue loading indicators", () => {
  it("shows a spinner at once and the searching text after a delay", async () => {
    const slow = deferred();
    const client = fakeClient({ getBlock: (q) => (q.index === 777 ? slow.promise : block({ height: q.index })) });
    const { wrapper } = mountExplorer({ client, path: "/mainnet/block/5" });
    await settle();
    const search = wrapper.vm.searchBCHD("777");
    await settle(2);
    expect(wrapper.find(".control").classes()).toContain("is-loading");
    expect(wrapper.find("section").attributes("aria-busy")).toBe("true");
    expect(statusTexts(wrapper)).toEqual([]);
    await sleep(350);
    expect(statusTexts(wrapper)).toEqual(["Searching\u2026"]);
    slow.resolve(block({ height: 777 }));
    await search;
    await settle(2);
    expect(wrapper.find(".control").classes()).not.toContain("is-loading");
    expect(statusTexts(wrapper)).toEqual([]);
  });

  it("never shows the searching text for a fast lookup", async () => {
    const client = fakeClient({ getBlock: (q) => block({ height: q.index }) });
    const { wrapper } = mountExplorer({ client, path: "/mainnet/block/5" });
    await settle();
    await wrapper.vm.searchBCHD("6");
    await sleep(350);
    expect(statusTexts(wrapper)).toEqual([]);
    expect(wrapper.vm.searching).toBe(false);
  });

  it("stops the spinner when a search is abandoned", async () => {
    const slow = deferred();
    const client = fakeClient({
      getBlockchainInfo: () => blockchainInfo({ height: 5 }),
      getBlock: (q) => (q.index === 777 ? slow.promise : block({ height: q.index })),
    });
    const { wrapper } = mountExplorer({ client, path: "/mainnet/block/5" });
    await settle();
    const search = wrapper.vm.searchBCHD("777");
    await settle(2);
    expect(wrapper.vm.searching).toBe(true);
    wrapper.vm.goHome();
    await settle(2);
    expect(wrapper.vm.searching).toBe(false);
    slow.resolve(block({ height: 777 }));
    await search;
    await settle(2);
    expect(wrapper.vm.searching).toBe(false);
    expect(wrapper.vm.block).toBe("");
  });

  it("says it is connecting until the node answers", async () => {
    const info = deferred();
    const { wrapper } = mountExplorer({ client: fakeClient({ getBlockchainInfo: () => info.promise }) });
    await settle(2);
    expect(wrapper.find(".info-result").text()).toBe("Connecting to bchd.greyh.at\u2026");
    expect(wrapper.find(".control").classes()).toContain("is-loading");
    info.resolve(blockchainInfo({ height: 10 }));
    await settle();
    expect(wrapper.find(".info-result").text()).toMatch(/^Height: 10 Block Hash:/);
    expect(wrapper.find(".control").classes()).not.toContain("is-loading");
  });

  it("says when it couldn't connect", async () => {
    const client = fakeClient({ getBlockchainInfo: () => { throw grpcError(Code.Unknown, "Response closed without headers"); } });
    const { wrapper } = mountExplorer({ client });
    await settle();
    expect(wrapper.find(".info-result").text()).toBe("Not connected (select another server)");
    expect(wrapper.vm.connecting).toBe(false);
  });

  it("shows that recent blocks are loading on the first load", async () => {
    const pending = [];
    const client = fakeClient({
      getBlockchainInfo: () => blockchainInfo({ height: 20 }),
      getBlock: (q) => {
        const d = deferred();
        pending.push(() => d.resolve(block({ height: q.index })));
        return d.promise;
      },
    });
    const { wrapper } = mountExplorer({ client });
    await settle();
    expect(statusTexts(wrapper)).toEqual(["Loading recent blocks\u2026"]);
    while (pending.length) {
      pending.shift()();
      await settle(2);
    }
    await settle();
    expect(statusTexts(wrapper)).toEqual([]);
    expect(wrapper.findAll("#recentblocks tbody tr").length).toBe(10);
  });
});

describe("BCHDExplorer.vue home page", () => {
  it("lists the newest blocks, a few calls at a time", async () => {
    let active = 0;
    let most = 0;
    const client = fakeClient({
      getBlockchainInfo: () => blockchainInfo({ height: 1000 }),
      getBlock: async (q) => {
        active++;
        most = Math.max(most, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return block({ height: q.index, txids: [hexHash(1), hexHash(2), hexHash(3)] });
      },
    });
    const { wrapper } = mountExplorer({ client });
    await settle(40);
    expect(wrapper.vm.recentBlocks.map((b) => b.height)).toEqual([1000, 999, 998, 997, 996, 995, 994, 993, 992, 991]);
    expect(most).toBeLessThanOrEqual(3);
    const rows = wrapper.findAll("#recentblocks tbody tr");
    expect(rows.length).toBe(10);
    expect(rows.at(0).findAll("td").at(2).text()).toBe("3");
    expect(rows.at(0).find("a").attributes("href")).toBe("/mainnet/block/1000");

    // The same tip isn't fetched again; a new one is.
    const calls = client.count("getBlock");
    await wrapper.vm.getInfo();
    await settle(40);
    expect(client.count("getBlock")).toBe(calls);
    client.getBlockchainInfo = () => Promise.resolve(blockchainInfo({ height: 1001 }));
    await wrapper.vm.getInfo();
    await settle(40);
    expect(wrapper.vm.recentBlocks[0].height).toBe(1001);
  });

  it("summarizes the mempool", async () => {
    const proof = { proofHash: hexHash(0xd5), txid: TXID, outpointTxid: hexHash(0x111), vout: 1 };
    const client = fakeClient({
      getMempoolInfo: () => mempoolInfo(91, 61497),
      getDoubleSpendProofs: () => doubleSpendProofs([proof, proof]),
    });
    const { wrapper } = mountExplorer({ client });
    await settle();
    expect(wrapper.find("#mempoolstats h2").text()).toBe("Mempool");
    expect(mempoolCells(wrapper)).toEqual([
      ["Unconfirmed Transactions", "Size", "Double Spend Proofs"],
      ["91", "61.5 kB", "2"],
    ]);

    // Refreshed with the status poll.
    client.getMempoolInfo = () => Promise.resolve(mempoolInfo(1, 200));
    client.getDoubleSpendProofs = () => Promise.resolve(doubleSpendProofs([]));
    await wrapper.vm.getInfo();
    await settle();
    expect(mempoolCells(wrapper)[1]).toEqual(["1", "200 B", "0"]);
  });

  it("leaves out what the node can't answer", async () => {
    const client = fakeClient({
      getMempoolInfo: () => mempoolInfo(5, 1000),
      getDoubleSpendProofs: () => { throw grpcError(Code.Unavailable, "double spend proofs are disabled"); },
    });
    const { wrapper } = mountExplorer({ client });
    await settle();
    expect(mempoolCells(wrapper)).toEqual([["Unconfirmed Transactions", "Size"], ["5", "1 kB"]]);

    client.getMempoolInfo = () => Promise.reject(grpcError(Code.ResourceExhausted, "busy"));
    await wrapper.vm.getInfo();
    await settle();
    expect(wrapper.find("#mempoolstats").exists()).toBe(false);
    // The rest of the home page is unaffected.
    expect(wrapper.find(".info-result").text()).toMatch(/^Height:/);
  });

  it("shows mempool stats only on the home page", async () => {
    const client = fakeClient({
      getMempoolInfo: () => mempoolInfo(3, 600),
      getBlock: (q) => block({ height: q.index }),
    });
    const { wrapper } = mountExplorer({ client, path: "/mainnet/block/5" });
    await settle();
    expect(wrapper.find("#mempoolstats").exists()).toBe(false);
    expect(client.count("getMempoolInfo")).toBe(0);
  });

  it("hides recent blocks while a result is shown", async () => {
    const client = fakeClient({
      getBlockchainInfo: () => blockchainInfo({ height: 20 }),
      getBlock: (q) => block({ height: q.index }),
    });
    const { wrapper } = mountExplorer({ client });
    await settle(20);
    expect(wrapper.find("#recentblocks").exists()).toBe(true);
    await wrapper.vm.searchBCHD("5");
    await settle();
    expect(wrapper.find("#recentblocks").exists()).toBe(false);
  });
});
