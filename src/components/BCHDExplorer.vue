<!--
 Copyright 2020 Coinbase, Inc.
 Copyright 2026 Josh Ellithorpe

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

<template>
  <div class="explorer">
    <section
      class="section"
      :aria-busy="searching || connecting || mempoolLoading ? 'true' : 'false'"
    >
      <div class="container has-text-right">
        <select v-model="selectedNetwork" @change="updateNetwork">
          <option v-for="node in nodes" :value="node.url" :key="node.url">
            {{ node.name }} ({{ node.network }})
          </option>
        </select>
      </div>
      <br />
      <div class="container">
        <router-link to="/" class="logo-link" @click="goHome">
          <img class="logo" src="../assets/bchd-explorer.svg" alt="BCHD Explorer" />
        </router-link>
        <div class="field">
          <div
            class="control has-icons-left"
            :class="{ 'is-loading': searching || connecting }"
          >
            <input
              class="input is-primary"
              type="text"
              v-model="input"
              :autofocus="'autofocus'"
              autocomplete="off"
              placeholder="Address, transaction or block hash/height"
              @keyup.enter="search"
            />
            <span class="icon is-small is-left">
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" stroke-width="2" />
                <line x1="10.3" y1="10.3" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </span>
          </div>
        </div>
      </div>
      <div class="info-result container has-text-centered info-result">
        <template v-if="tip.hash">Height: <ResultLink type="block" :value="tip.height" :network="network" /> Block Hash: <ResultLink type="block" :value="tip.hash" :network="network" /></template>
        <span v-else-if="connecting" role="status"><span class="loader inline-loader"></span>Connecting to {{ connectingTo }}…</span>
        <template v-else>{{ infoResult }}</template>
      </div>
      <div
        class="container results has-text-centered"
        v-if="showSearching"
        role="status"
      >
        <span class="loader inline-loader"></span>Searching…
      </div>
      <div
        class="container results has-text-centered"
        v-show="result.length"
        v-cloak
      >
        <strong>{{ result }}</strong>
      </div>
      <div class="container results" v-show="address.length" v-cloak>
        <BCHAddress
          :address="address"
          :addressData="addressData"
          :network="network"
        />
      </div>
      <div class="container results" v-show="block.length" v-cloak>
        <BCHBlock :block="block" :blockData="blockData" :network="network" />
      </div>
      <div class="container results" v-show="transaction.length" v-cloak>
        <BCHTransaction
          :transaction="transaction"
          v-bind:transactionData="transactionData"
          :network="network"
        />
      </div>
      <div
        class="container results"
        id="mempoolstats"
        v-if="isHome && mempoolStats"
      >
        <h2>Mempool</h2>
        <table class="table is-bordered is-striped" align="center">
          <thead>
            <tr>
              <th>Unconfirmed Transactions</th>
              <th>Size</th>
              <th v-if="mempoolStats.proofs !== null">Double Spend Proofs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{{ mempoolStats.count }}</td>
              <td>{{ prettyBytes(mempoolStats.bytes) }}</td>
              <td v-if="mempoolStats.proofs !== null">{{ mempoolStats.proofs }}</td>
            </tr>
          </tbody>
        </table>
        <router-link
          class="mempool-link"
          :to="{ name: 'mempool', params: { network } }"
          >View mempool &rarr;</router-link
        >
      </div>
      <div
        class="container results"
        v-if="mempoolView && !address && !block && !transaction"
      >
        <Mempool
          :mempool="mempool"
          :loading="mempoolLoading"
          :error="mempoolError"
          :network="network"
          :loadDetails="loadMempoolDetails"
          @refresh="loadMempool"
        />
      </div>
      <div class="container results" v-if="isHome && recentBlocks.length">
        <RecentBlocks :blocks="recentBlocks" :network="network" />
      </div>
      <div
        class="container results has-text-centered"
        v-else-if="isHome && loadingRecent && !searching"
        role="status"
      >
        <span class="loader inline-loader"></span>Loading recent blocks…
      </div>
    </section>
    <footer class="has-text-centered">
      <div>Copyright &copy; 2026 Josh Ellithorpe</div>
      <div class="is-size-7">
        <a href="https://github.com/zquestz/bchd-explorer/blob/master/LICENSE.md">Apache 2.0</a> &middot;
        <a href="https://github.com/zquestz/bchd-explorer">Source on GitHub</a>
      </div>
    </footer>
  </div>
</template>

<script>
import Big from "big.js";
import { BchrpcClient, GrpcCode, pb } from "../bchrpc";
import { parseAddress } from "../address";
import { fromTokenAware, toTokenAware } from "../cashaddr";
import { toHex, toUtf8 } from "../hex";
import BCHAddress from "./BCHAddress.vue";
import BCHBlock from "./BCHBlock.vue";
import BCHTransaction from "./BCHTransaction.vue";
import Mempool from "./Mempool.vue";
import RecentBlocks from "./RecentBlocks.vue";
import ResultLink from "./ResultLink.vue";
import sb from "satoshi-bitcoin";
import prettyBytes from "pretty-bytes";

const TESTNET4 = "testnet4";
const MAINNET = "mainnet";

// Before the explorer read the network from the node, it put "testnet3" in
// routes for its testnet4 servers, so links shared then still use it.
const LEGACY_ROUTE_NETWORKS = { testnet3: TESTNET4 };

// bchd returns at most this many transactions per address query, newest
// first.
const MAX_ADDRESS_TXS = 10000;
// The block height bchd reports for unspent outputs still in the mempool
// (mining.UnminedHeight).
const UNMINED_HEIGHT = 0x7fffffff;


// The mempool page fetches whole mempools up to this many transactions
// (about 1.5 kB each); larger ones are listed by hash, with details fetched
// a page at a time, MEMPOOL_DETAILS_CONCURRENCY lookups at once.
const MEMPOOL_FULL_LIMIT = 5000;
const MEMPOOL_DETAILS_CONCURRENCY = 3;
// SlpAction values from SLP_V1_GENESIS up are SLP token transactions.
const SLP_V1_GENESIS = 4;

// How long a search runs before "Searching…" appears, in milliseconds.
const SEARCHING_TEXT_DELAY = 300;

// The home page lists this many of the newest blocks, fetching at most
// RECENT_BLOCKS_CONCURRENCY at a time: bchd limits each server to 16 calls
// in progress across all its clients.
const RECENT_BLOCKS = 10;
const RECENT_BLOCKS_CONCURRENCY = 3;

// mapLimit runs fn on each item, at most limit at a time, and returns the
// results in order, with null for any that failed.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]).catch(() => null);
    }
  };
  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// Errors bchd gives when the node runs without an index a lookup needs.
const MISSING_INDEXES = {
  "addrindex required": ["an address index (--addrindex)", "addresses"],
  "txindex required": ["a transaction index (--txindex)", "transactions"],
  "slpindex required": ["an SLP index (--slpindex)", "SLP tokens"],
};

// Maps the node's reported network (GetBlockchainInfoResponse.BitcoinNet) to
// the names used in routes, e.g. 5 to "chipnet".
const NETWORK_NAMES = Object.fromEntries(
  Object.entries(pb.GetBlockchainInfoResponse.BitcoinNet).map(
    ([name, value]) => [value, name.toLowerCase()]
  )
);

// CashToken bitfield flags and NFT capabilities, from the CashTokens spec.
const CASHTOKEN_HAS_AMOUNT = 0x10;
const CASHTOKEN_HAS_NFT = 0x20;
const CASHTOKEN_CAPABILITY_MASK = 0x0f;
const CASHTOKEN_CAPABILITIES = ["immutable", "mutable", "minting"];

export default {
  name: "explorer",
  components: {
    BCHAddress,
    BCHBlock,
    BCHTransaction,
    Mempool,
    RecentBlocks,
    ResultLink,
  },
  data: function () {
    return {
      result: "",
      infoResult: " ",
      // The node's newest block, shown in the status line.
      tip: { height: null, hash: "" },
      // { count, bytes, proofs } for the home page; proofs is null when the
      // node can't list double spend proofs.
      mempoolStats: null,
      // The mempool page's snapshot (see loadMempool) and its state.
      mempool: null,
      mempoolLoading: false,
      mempoolError: "",
      recentBlocks: [],
      // The tip height recentBlocks was loaded for.
      recentBlocksTip: null,
      // Loading state for the spinners.
      searching: false,
      showSearching: false,
      connecting: false,
      // The server name shown while connecting.
      connectingTo: "",
      loadingRecent: false,
      input: "",
      network: MAINNET,
      nodeIndexes: this.defaultNodeIndexes(),
      lookupErrors: [],
      address: "",
      addressData: this.defaultAddressData(),
      transaction: "",
      transactionData: this.defaultTransactionData(),
      block: "",
      blockData: this.defaultBlockData(),
      getInfoBar: true,
      nodes: [
        {
          url: "https://bchd.greyh.at:8335",
          name: "bchd.greyh.at",
          network: MAINNET,
        },
        {
          url: "https://localhost:8335",
          name: "localhost:8335",
          network: MAINNET,
        },
        {
          url: "https://bchd-testnet.greyh.at:18335",
          name: "bchd-testnet.greyh.at",
          network: TESTNET4,
        },
        {
          url: "https://localhost:18335",
          name: "localhost:18335",
          network: TESTNET4,
        },
      ],
      selectedNetwork: "https://bchd.greyh.at:8335",
    };
  },
  computed: {
    // pageTitle names the result shown, so browser tabs and the history menu
    // tell pages apart.
    pageTitle: function () {
      const short = (value) => `${value.slice(0, 10)}\u2026`;
      let subject = "";
      if (this.address) {
        subject = `Address ${short(this.address.split(":").pop())}`;
      } else if (this.block) {
        subject = `Block ${this.blockData.height}`;
      } else if (this.transaction) {
        subject = `Transaction ${short(this.transaction)}`;
      } else if (this.mempoolView) {
        subject = "Mempool";
      }
      return subject ? `${subject} \u00b7 BCHD Explorer` : "BCHD Explorer";
    },
    mempoolView: function () {
      return this.$route.name === "mempool";
    },
    // isHome is true on the home page while no result is shown.
    isHome: function () {
      return (
        this.routeInput(this.$route) === undefined &&
        !this.mempoolView &&
        !this.address &&
        !this.block &&
        !this.transaction
      );
    },
  },
  mounted() {
    // Links carry their network, so start on a server for it.
    this.selectNodeForNetwork(this.$route.params.network);
    this.updateNetwork();
  },
  watch: {
    pageTitle: {
      immediate: true,
      handler: function (title) {
        document.title = title;
      },
    },
    // Back, forward and edited URLs change the route without a search, as
    // every route reuses this component.
    $route(to) {
      const input = this.routeInput(to);
      if (input !== undefined && input === this.currentQuery) {
        // The route a search pushed for its own results.
        return;
      }
      if (this.selectNodeForNetwork(to.params.network)) {
        this.input = input || "";
        // updateNetwork searches the route's input on the new server.
        this.updateNetwork();
        return;
      }
      if (to.name === "mempool") {
        this.cancelSearch();
        this.resetState();
        this.input = "";
        this.loadMempool();
        return;
      }
      if (input === undefined) {
        this.cancelSearch();
        this.resetState();
        this.input = "";
        this.loadRecentBlocks();
        this.loadMempoolStats();
        return;
      }
      this.input = input;
      this.searchBCHD(input);
    },
  },
  methods: {
    // routeInput returns the address, block or transaction a route shows.
    routeInput: function (route) {
      const params = route.params;
      return params.address || params.blockHash || params.txId;
    },
    // selectNodeForNetwork selects the first listed server for a route's
    // network unless the selected one is for it. Returns whether the
    // selection changed.
    selectNodeForNetwork: function (routeNetwork) {
      const current = this.nodes.find((n) => n.url === this.selectedNetwork);
      if (!routeNetwork || (current && current.network === routeNetwork)) {
        return false;
      }
      const match =
        this.nodes.find((n) => n.network === routeNetwork) ||
        this.nodes.find(
          (n) => n.network === LEGACY_ROUTE_NETWORKS[routeNetwork]
        );
      if (!match || match.url === this.selectedNetwork) {
        return false;
      }
      this.selectedNetwork = match.url;
      return true;
    },
    // isStale reports whether a newer search or server change has replaced
    // the search with this token.
    isStale: function (token) {
      return token !== undefined && token !== this.searchToken;
    },
    debug(val) {
      window.console.log(val);
    },
    search: async function () {
      this.searchBCHD(this.input);
    },
    // beginSearch shows the spinners. The "Searching…" text waits
    // SEARCHING_TEXT_DELAY so that fast lookups don't flash it.
    beginSearch: function () {
      this.searching = true;
      clearTimeout(this.searchingTimer);
      this.searchingTimer = setTimeout(() => {
        this.showSearching = this.searching;
      }, SEARCHING_TEXT_DELAY);
    },
    endSearch: function () {
      clearTimeout(this.searchingTimer);
      this.searching = false;
      this.showSearching = false;
    },
    // cancelSearch abandons any search in progress, e.g. on going home.
    cancelSearch: function () {
      this.searchToken++;
      this.currentQuery = undefined;
      this.endSearch();
    },
    searchBCHD: async function (input) {
      // Pasted values often carry spaces or a newline.
      input = typeof input === "string" ? input.trim() : input;
      this.resetState();
      const token = ++this.searchToken;

      if (input == "") {
        this.currentQuery = undefined;
        this.endSearch();
        this.$router.push({ name: "home" }).catch(() => {});
        return;
      }
      this.beginSearch();
      try {
        await this.runSearch(input, token);
      } finally {
        // A newer search owns the spinner.
        if (!this.isStale(token)) {
          this.endSearch();
        }
      }
    },
    // runSearch looks input up as an address, block or transaction, in that
    // order, and pushes the route for what it finds.
    runSearch: async function (input, token) {
      // The route watcher skips the route pushed below for this input.
      this.currentQuery = input;
      // Token-aware addresses (z..., r...) are looked up by their standard
      // form, which the node indexes by.
      const address = parseAddress(fromTokenAware(input) || input);
      if (address) {
        await this.populateAddressData(address, token);
        if (this.isStale(token)) {
          return;
        }
        this.$router
          .push({
            name: "address",
            params: {
              network: this.determineNetwork(),
              address: input,
            },
          })
          .catch(() => {});
        return;
      }
      var blockData = await this.populateBlockData(input, token);
      if (this.isStale(token)) {
        return;
      }
      if (blockData === true) {
        this.$router
          .push({
            name: "block",
            params: {
              network: this.determineNetwork(),
              blockHash: input,
            },
          })
          .catch(() => {});
        return;
      }
      var transactionData = await this.populateTransactionData(input, token);
      if (this.isStale(token)) {
        return;
      }
      if (transactionData === true) {
        this.$router
          .push({
            name: "tx",
            params: {
              network: this.determineNetwork(),
              txId: input,
            },
          })
          .catch(() => {});
        return;
      }
      this.result = this.lookupErrors.length
        ? this.lookupErrors.join("\n")
        : "No address, transaction or block hash/height found.";
    },
    // describeError explains a failed lookup, or returns null when the node
    // just has no such item or the input isn't one.
    describeError: function (error) {
      const code = error ? error.code : undefined;
      const message = (error && error.message) || "";
      switch (code) {
        case undefined:
        case GrpcCode.NotFound:
        case GrpcCode.InvalidArgument:
          return null;
        case GrpcCode.ResourceExhausted:
          return "The node is busy (a request limit was reached). Try again shortly.";
        case GrpcCode.Aborted:
          return "The chain changed during the lookup. Try again.";
        case GrpcCode.Unavailable:
          if (MISSING_INDEXES[message]) {
            const [index, things] = MISSING_INDEXES[message];
            return `This node runs without ${index}, so it can't look up ${things}.`;
          }
          return `Couldn't reach the node: ${message}`;
        case GrpcCode.Unknown:
          return `Couldn't reach the node: ${message}`;
        default:
          return `The node returned an error: ${message}`;
      }
    },
    // recordError keeps a lookup failure to report if nothing is found.
    recordError: function (error) {
      const message = this.describeError(error);
      if (message && !this.lookupErrors.includes(message)) {
        this.lookupErrors.push(message);
      }
    },
    determineNetwork: function () {
      return this.network;
    },
    // goHome clears the page when the logo is clicked. On another route the
    // route watcher does the same; on "/" the route doesn't change.
    goHome: function () {
      this.cancelSearch();
      this.resetState();
      this.input = "";
      this.loadRecentBlocks();
      this.loadMempoolStats();
    },
    // loadMempoolStats fetches the home page's mempool summary. Both calls
    // are cheap; a node that can't list double spend proofs (disabled, or
    // older than bchd 0.22.3) still shows the rest.
    loadMempoolStats: async function () {
      const client = this.grpc;
      if (!client) {
        return;
      }
      const [info, proofs] = await Promise.all([
        client.getMempoolInfo().catch(() => null),
        client
          .getDoubleSpendProofs()
          .then((res) => res.getProofsList().length)
          .catch(() => null),
      ]);
      if (client !== this.grpc) {
        return;
      }
      this.mempoolStats = info
        ? { count: info.getSize(), bytes: info.getBytes(), proofs }
        : null;
    },

    prettyBytes,
    // loadMempool fetches the mempool page's snapshot: the whole mempool when
    // it has at most MEMPOOL_FULL_LIMIT transactions, otherwise their hashes.
    loadMempool: async function () {
      const client = this.grpc;
      if (!client) {
        return;
      }
      const token = ++this.mempoolToken;
      const current = () => client === this.grpc && token === this.mempoolToken;
      this.mempoolLoading = true;
      this.mempoolError = "";
      try {
        const [info, proofs] = await Promise.all([
          client.getMempoolInfo(),
          client
            .getDoubleSpendProofs()
            .then((res) => res.getProofsList().map((p) => this.parseMempoolProof(p)))
            .catch(() => null),
        ]);
        const full = info.getSize() <= MEMPOOL_FULL_LIMIT;
        const list = (
          await client.getMempool({ fullTransactions: full })
        ).getTransactionDataList();
        if (!current()) {
          return;
        }
        const txs = full
          ? list.map((td) => this.summarizeMempoolTx(td.getTransaction()))
          : [];
        const hashes = full
          ? []
          : list.map((td) => this.convertHash(td.getTransactionHash_asU8()));
        this.mempool = Object.freeze({
          asOf: Math.floor(Date.now() / 1000),
          bytes: info.getBytes(),
          full,
          txs: Object.freeze(txs),
          hashes: Object.freeze(hashes),
          proofs,
          stats: full ? this.mempoolStatsOf(txs) : null,
        });
      } catch (error) {
        if (current()) {
          this.mempoolError =
            this.describeError(error) || "Couldn't load the mempool.";
        }
      } finally {
        if (current()) {
          this.mempoolLoading = false;
        }
      }
    },
    // loadMempoolDetails summarizes transactions of a mempool too large to
    // fetch whole, a few lookups at a time; null for any that failed.
    loadMempoolDetails: function (txids) {
      const client = this.grpc;
      return mapLimit(txids, MEMPOOL_DETAILS_CONCURRENCY, (txid) =>
        client
          .getTransaction({
            hash: txid,
            reversedHashOrder: true,
            includeTokenMetadata: false,
          })
          .then((res) => this.summarizeMempoolTx(res.getTransaction()))
      );
    },
    // summarizeMempoolTx keeps what the mempool page shows of a transaction.
    // Its fee comes from input values, which bchd fills in.
    summarizeMempoolTx: function (tx) {
      const sum = (items) => items.reduce((s, item) => s + item.getValue(), 0);
      const value = sum(tx.getOutputsList());
      const fee = sum(tx.getInputsList()) - value;
      const slp = tx.getSlpTransactionInfo();
      return {
        txid: this.convertHash(tx.getHash_asU8()),
        size: tx.getSize(),
        value,
        fee_rate: fee >= 0 && tx.getSize() > 0 ? fee / tx.getSize() : null,
        cashtoken:
          tx.getOutputsList().some((o) => o.getCashToken()) ||
          tx.getInputsList().some((i) => i.getCashToken()),
        slp: !!slp && slp.getSlpAction() >= SLP_V1_GENESIS,
      };
    },
    mempoolStatsOf: function (txs) {
      const rates = txs
        .map((tx) => tx.fee_rate)
        .filter((r) => r !== null)
        .sort((a, b) => a - b);
      const rate = (r) => `${r.toFixed(2)} sat/B`;
      return {
        fee_rates: rates.length
          ? `${rate(rates[0])} / ${rate(rates[Math.floor(rates.length / 2)])} / ${rate(rates[rates.length - 1])}`
          : "",
        total_value: txs.reduce((s, tx) => s + tx.value, 0),
        cashtokens: txs.filter((tx) => tx.cashtoken).length,
        slp: txs.filter((tx) => tx.slp).length,
      };
    },
    parseMempoolProof: function (proof) {
      const outpoint = proof.getOutpoint();
      return {
        hash: this.convertHash(proof.getHash_asU8()),
        txid: this.convertHash(proof.getTransactionHash_asU8()),
        outpoint_hash: outpoint ? this.convertHash(outpoint.getHash_asU8()) : "",
        outpoint_index: outpoint ? outpoint.getIndex() : "",
      };
    },
    // loadRecentBlocks fetches the newest blocks for the home page, unless
    // they were already fetched for the current tip.
    loadRecentBlocks: async function () {
      const tipHeight = this.tip.height;
      if (tipHeight === null || tipHeight === this.recentBlocksTip) {
        return;
      }
      this.recentBlocksTip = tipHeight;
      this.loadingRecent = true;
      const client = this.grpc;
      const heights = [];
      for (let h = tipHeight; h >= 0 && h > tipHeight - RECENT_BLOCKS; h--) {
        heights.push(h);
      }
      const blocks = await mapLimit(
        heights,
        RECENT_BLOCKS_CONCURRENCY,
        async (height) => {
          const block = (await client.getBlock({ index: height })).getBlock();
          const info = block.getInfo();
          return {
            height: info.getHeight(),
            hash: this.convertHash(info.getHash_asU8()),
            timestamp: info.getTimestamp(),
            transaction_count: block.getTransactionDataList().length,
            size: info.getSize(),
          };
        }
      );
      if (client !== this.grpc || tipHeight !== this.recentBlocksTip) {
        // The server changed, or a newer tip started its own load.
        return;
      }
      this.loadingRecent = false;
      const loaded = blocks.filter((b) => b !== null);
      if (!loaded.length) {
        // Let the next status refresh try again.
        this.recentBlocksTip = null;
        return;
      }
      this.recentBlocks = Object.freeze(loaded);
    },

    // populateAddressData looks up an address, given as parseAddress returns.
    populateAddressData: async function (parsed, token) {
      const addr = parsed.cash;
      try {
        const utxoQuery = {
          address: addr,
          includeMempool: true,
          includeTokenMetadata: this.nodeIndexes.slp !== false,
        };
        var addrUtxoResult;
        try {
          addrUtxoResult = await this.grpc.getAddressUtxos(utxoQuery);
        } catch (error) {
          // bchd aborts this call when the chain reorganizes during it.
          if (!error || error.code !== GrpcCode.Aborted) {
            throw error;
          }
          addrUtxoResult = await this.grpc.getAddressUtxos(utxoQuery);
        }
        var addrResult = await this.grpc.getAddressTransactions({
          address: addr,
          nbFetch: MAX_ADDRESS_TXS,
        });
        if (this.isStale(token)) {
          return;
        }
        this.address = addr;
        var total = 0;
        addrUtxoResult.getOutputsList().forEach(function (a) {
          total += a.getValue();
        });
        this.addressData["utxos"] = addrUtxoResult.getOutputsList().length;
        this.addressData["satoshis"] = total;
        this.addressData["balance"] = sb.toBitcoin(total);
        this.addressData["legacy"] = parsed.legacy;
        this.addressData["cash"] = parsed.cash;
        this.addressData["slp"] = parsed.slp;
        this.addressData["token_aware"] =
          toTokenAware(this.addressData["cash"]) || "";
        const confirmed = addrResult.getConfirmedTransactionsList().length;
        this.addressData["confirmed_transactions"] =
          confirmed >= MAX_ADDRESS_TXS ? `${MAX_ADDRESS_TXS}+` : confirmed;
        this.addressData["unconfirmed_transactions"] =
          addrResult.getUnconfirmedTransactionsList().length;
        const _tokens = new Map();
        const tokenMetadata = new Map();
        addrUtxoResult.getTokenMetadataList().forEach((tm) => {
          const _id = toHex(tm.getTokenId_asU8());
          const _tmObj = { token_id: _id, name: "", ticker: "" };
          tokenMetadata.set(_id, _tmObj);
          if (tm.hasV1Fungible()) {
            _tmObj.name = tm.getV1Fungible().getTokenName();
            _tmObj.ticker = tm.getV1Fungible().getTokenTicker();
            _tmObj.document_url =
              tm.getV1Fungible().getTokenDocumentUrl() !== ""
                ? tm.getV1Fungible().getTokenDocumentUrl()
                : "NA";
            _tmObj.document_hash =
              tm.getV1Fungible().getTokenDocumentHash() !== ""
                ? tm.getV1Fungible().getTokenDocumentHash()
                : "NA";
            _tmObj.mint_baton_txid = toHex(
              tm.getV1Fungible().getMintBatonHash_asU8().slice().reverse()
            );
            _tmObj.mint_baton_vout = tm.getV1Fungible().getMintBatonVout();
          } else if (tm.hasV1Nft1Group()) {
            _tmObj.name = tm.getV1Nft1Group().getTokenName();
            _tmObj.ticker = tm.getV1Nft1Group().getTokenTicker();
            _tmObj.document_url =
              tm.getV1Nft1Group().getTokenDocumentUrl() !== ""
                ? tm.getV1Nft1Group().getTokenDocumentUrl()
                : "NA";
            _tmObj.document_hash = tm
              .getV1Nft1Group()
              .getTokenDocumentHash_asB64()
              ? tm.getV1Nft1Group().getTokenDocumentHash()
              : "NA";
            _tmObj.mint_baton_txid = toHex(
              tm.getV1Nft1Group().getMintBatonHash_asU8().slice().reverse()
            );
            _tmObj.mint_baton_vout = tm.getV1Nft1Group().getMintBatonVout();
          } else if (tm.hasV1Nft1Child()) {
            _tmObj.name = tm.getV1Nft1Child().getTokenName();
            _tmObj.ticker = tm.getV1Nft1Child().getTokenTicker();
            _tmObj.document_url =
              tm.getV1Nft1Child().getTokenDocumentUrl() !== ""
                ? tm.getV1Nft1Child().getTokenDocumentUrl()
                : "NA";
            _tmObj.document_hash = tm
              .getV1Nft1Child()
              .getTokenDocumentHash_asB64()
              ? toUtf8(tm.getV1Nft1Child().getTokenDocumentHash_asU8())
              : "NA";
            _tmObj.nft_group_id = toHex(tm.getV1Nft1Child().getGroupId_asU8());
          }
        });
        addrUtxoResult.getOutputsList().forEach(function (a) {
          if (a.getSlpToken()) {
            const tok = a.getSlpToken();
            const tokenID = toHex(tok.getTokenId_asU8());
            if (_tokens.has(tokenID)) {
              const _tok = _tokens.get(tokenID);
              _tok.balance = _tok.balance.add(tok.getAmount());
            } else {
              _tokens.set(tokenID, {
                token_id: tokenID,
                // SLPAddress reads token_metadata unconditionally, so fall
                // back to placeholders when the node returned none.
                token_metadata: tokenMetadata.get(tokenID) || {
                  token_id: tokenID,
                  name: "NA",
                  ticker: "tokens",
                },
                decimals: tok.getDecimals(),
                balance: Big(tok.getAmount()),
              });
            }
          }
        });
        this.addressData["tokens"] = Array.from(_tokens).map((v) => v[1]);
        this.addressData["cashtokens"] = this.summarizeCashTokens(
          addrUtxoResult
            .getOutputsList()
            .map((a) => this.parseCashToken(a.getCashToken()))
        );
        this.addressData["transaction_list"] = this.listAddressTransactions(
          addr,
          addrResult
        );
        this.addressData["utxo_list"] = this.listUtxos(
          addrUtxoResult,
          tokenMetadata
        );
      } catch (error) {
        if (this.isStale(token)) {
          return;
        }
        this.result = this.describeError(error) || "Address not found.";
      }
    },
    populateBlockData: async function (input, token) {
      // Only plain decimal input is a height; a loose numeric comparison
      // would also accept forms such as "1e3" or "0x10".
      var blockFinder =
        /^\d+$/.test(input) && Number(input) < 10000000 ? "height" : "hash";
      try {
        var blockResult = "";
        if (blockFinder === "height") {
          blockResult = await this.grpc.getBlock({ index: Number(input) });
        } else {
          blockResult = await this.grpc.getBlock({
            hash: input,
            reversedHashOrder: true,
          });
        }
        if (this.isStale(token)) {
          return false;
        }
        var blockInfo = blockResult.getBlock().getInfo();
        const hashes = blockResult
          .getBlock()
          .getTransactionDataList()
          .map((td) => this.convertHash(td.getTransactionHash_asU8()));
        this.blockData["transaction_count"] = hashes.length;
        // Blocks can hold over 100,000 transactions, which the block page
        // pages through; frozen so Vue doesn't track each one.
        this.blockData["transactions"] = Object.freeze(hashes);
        this.block = this.convertHash(blockInfo.getHash());
        this.blockData["height"] = blockInfo.getHeight();
        this.blockData["version"] = blockInfo.getVersion();
        var previousBlock = blockInfo.getPreviousBlock();
        if (previousBlock) {
          this.blockData["previous_block"] = this.convertHash(previousBlock);
        }
        this.blockData["merkle_root"] = this.convertHash(
          blockInfo.getMerkleRoot()
        );
        this.blockData["timestamp"] = blockInfo.getTimestamp();
        this.blockData["bits"] = blockInfo.getBits().toString(16);
        this.blockData["nonce"] = blockInfo.getNonce();
        this.blockData["confirmations"] = blockInfo.getConfirmations();
        this.blockData["difficulty"] = blockInfo.getDifficulty();
        var nextBlock = blockInfo.getNextBlockHash();
        if (nextBlock) {
          this.blockData["next_block_hash"] = this.convertHash(nextBlock);
        }
        this.blockData["size"] = prettyBytes(blockInfo.getSize());
        this.blockData["median_time"] = blockInfo.getMedianTime();
        return true;
      } catch (error) {
        if (!this.isStale(token)) {
          this.recordError(error);
        }
        return false;
      }
    },
    populateTransactionData: async function (input, token) {
      try {
        var txResult = await this.grpc.getTransaction({
          hash: input,
          reversedHashOrder: true,
          // bchd refuses the whole call for metadata without an SLP index.
          includeTokenMetadata: this.nodeIndexes.slp !== false,
        });
        if (this.isStale(token)) {
          return false;
        }
        this.transaction = input;
        var tx = txResult.getTransaction();
        this.transactionData["version"] = tx.getVersion();
        this.transactionData["lock_time"] = tx.getLockTime();
        this.transactionData["size"] = prettyBytes(tx.getSize());
        this.transactionData["timestamp"] = tx.getTimestamp();
        this.transactionData["confirmations"] = tx.getConfirmations();
        this.transactionData["block_height"] = tx.getBlockHeight();
        this.transactionData["block_hash"] = this.convertHash(
          tx.getBlockHash()
        );
        this.transactionData["inputs"] = tx.getInputsList();
        this.transactionData["outputs"] = tx.getOutputsList();
        this.setFee(tx);
        // set some slp properties
        this.transactionData["slp_action"] = tx
          .getSlpTransactionInfo()
          .getSlpAction();
        this.transactionData["slp_action_str"] =
          this.mapSlpTransactionTypeString(this.transactionData["slp_action"]);
        this.transactionData["slp_valid"] = tx
          .getSlpTransactionInfo()
          .getValidityJudgement();
        this.transactionData["slp_parse_error"] = tx
          .getSlpTransactionInfo()
          .getParseError();
        this.transactionData["burn_flags"] = this.mapBurnFlagToString(
          tx.getSlpTransactionInfo().getBurnFlagsList()
        );

        const inputAmtMap = new Map();
        let outputAmt = Big(0);
        // loop through txn outputs set view data for slp tokens
        this.transactionData["outputs"].forEach((o) => {
          o.cashToken = this.parseCashToken(o.getCashToken());
          o.token = undefined;
          if (o.getSlpToken()) {
            let tok = o.getSlpToken();
            if (tok) {
              o.token = {};
              o.token.amount = Big(tok.getAmount()).div(
                10 ** tok.getDecimals()
              );
              outputAmt = outputAmt.add(o.token.amount);
              o.token.isMintBaton = tok.getIsMintBaton();
              o.token.decimals = tok.getDecimals();
              o.token.address = tok.getAddress();
            }
          }
        });
        // set token metadata for valid slp transaction
        if (this.transactionData["slp_valid"] && txResult.getTokenMetadata()) {
          const tm = txResult.getTokenMetadata();
          const _id = toHex(tm.getTokenId_asU8());
          const _tmObj = { token_id: _id, name: "", ticker: "" };
          _tmObj.token_type = tm.getTokenType();
          if (tm.hasV1Fungible()) {
            _tmObj.name = tm.getV1Fungible().getTokenName();
            _tmObj.ticker = tm.getV1Fungible().getTokenTicker();
          } else if (tm.hasV1Nft1Group()) {
            _tmObj.name = tm.getV1Nft1Group().getTokenName();
            _tmObj.ticker = tm.getV1Nft1Group().getTokenTicker();
          } else if (tm.hasV1Nft1Child()) {
            _tmObj.name = tm.getV1Nft1Child().getTokenName();
            _tmObj.ticker = tm.getV1Nft1Child().getTokenTicker();
            _tmObj.nft_group_id = toHex(tm.getV1Nft1Child().getGroupId_asU8());
          }
          if (_tmObj.name === "") {
            _tmObj.name = "NA";
          }
          if (_tmObj.ticker === "") {
            _tmObj.ticker = "tokens";
          }
          this.transactionData["token_metadata"] = _tmObj;
        }
        // loop through txn inputs to populate slp token view data
        const dat = this.transactionData;
        this.transactionData["inputs"].forEach((i) => {
          i.cashToken = this.parseCashToken(i.getCashToken());
          i.token = undefined;
          if (i.getSlpToken()) {
            let tok = i.getSlpToken();
            if (tok) {
              i.token = {};
              i.token.amount = Big(tok.getAmount()).div(
                10 ** tok.getDecimals()
              );
              i.token.isMintBaton = tok.getIsMintBaton();
              i.token.decimals = tok.getDecimals();
              i.token.token_id = toHex(tok.getTokenId_asU8());
              i.token.slp_action = tok.getSlpAction();
              i.token.token_type = tok.getTokenType();
              if (dat.token_metadata) {
                if (
                  i.token.token_id !== dat.token_metadata.token_id ||
                  i.token.token_type !== dat.token_metadata.token_type
                ) {
                  i.token.isBurned = true;
                  i.token.ticker = "";
                } else {
                  i.token.ticker = dat["token_metadata"].ticker;
                }
              }
              // enumerate inputs for displaying burn quantity
              if (!inputAmtMap.has(i.token.token_id + i.token.token_type)) {
                inputAmtMap.set(
                  i.token.token_id + i.token.token_type,
                  i.token.amount
                );
              } else {
                let totalAmt = inputAmtMap.get(
                  i.token.token_id + i.token.token_type
                );
                totalAmt = totalAmt.add(i.token.amount);
                inputAmtMap.set(
                  i.token.token_id + i.token.token_type,
                  totalAmt
                );
              }
              if (
                dat.burn_flags.includes("BURNED_INPUTS_OUTPUTS_TOO_HIGH") ||
                dat.burn_flags.includes("BURNED_INPUTS_BAD_OPRETURN")
              ) {
                i.token.isBurned = true;
                i.token.ticker = "";
              }
            }
          }
        });
        // set burned amount to display
        if (dat.token_metadata) {
          for (const amt of inputAmtMap) {
            if (
              amt[0] ===
              dat.token_metadata.token_id + dat.token_metadata.token_type
            ) {
              amt[1] = amt[1].sub(outputAmt);
              if (amt[1].gt(0)) {
                dat.burn_amt_this_token = amt[1].toFixed();
              }
            } else {
              dat.burns_from_other_tokens = true;
            }
          }
        } else if (inputAmtMap.size > 0) {
          dat.burns_from_other_tokens = true;
        }
        if (dat.confirmations === 0) {
          // Not awaited so the transaction shows without waiting on proofs.
          this.populateDoubleSpendProof(input, dat);
        }
        return true;
      } catch (error) {
        if (!this.isStale(token)) {
          this.recordError(error);
        }
        return false;
      }
    },
    // setFee sets the transaction's fee from its input values, which bchd
    // fills in from the outputs they spend. Coinbase transactions pay none.
    setFee: function (tx) {
      const inputs = tx.getInputsList();
      const isCoinbase =
        inputs.length === 1 &&
        inputs[0]
          .getOutpoint()
          .getHash_asU8()
          .every((b) => b === 0);
      if (isCoinbase) {
        return;
      }
      const sum = (items) => items.reduce((s, item) => s + item.getValue(), 0);
      const fee = sum(inputs) - sum(tx.getOutputsList());
      if (fee >= 0) {
        this.transactionData["fee"] = fee;
        this.transactionData["fee_rate"] = (fee / tx.getSize()).toFixed(2);
      }
    },
    populateDoubleSpendProof: async function (txid, dat) {
      const client = this.grpc;
      const query = { hash: txid, reversedHashOrder: true };
      // Both calls fail with Unavailable when the node runs with
      // --nodoublespendproof, and Unimplemented before bchd 0.22.3; the
      // rows then stay hidden.
      const [score, proof] = await Promise.all([
        client
          .getDoubleSpendProofScore(query)
          .then((res) => res.getScore())
          .catch(() => null),
        client
          .getDoubleSpendProof(query)
          .then((res) => this.parseDoubleSpendProof(res))
          .catch((error) =>
            error && error.code === GrpcCode.NotFound ? false : null
          ),
      ]);
      if (client !== this.grpc || dat !== this.transactionData) {
        // Another search or server change happened while this ran.
        return;
      }
      dat.dsproof_score = score;
      // false means the node has no proof; null means the lookup failed.
      dat.dsproof = proof;
    },
    parseDoubleSpendProof: function (res) {
      const proof = res.getProof();
      const outpoint = proof.getOutpoint();
      const path = res.getPathList_asU8().map((h) => this.convertHash(h));
      return {
        hash: this.convertHash(proof.getHash_asU8()),
        outpoint_hash: outpoint ? this.convertHash(outpoint.getHash_asU8()) : "",
        outpoint_index: outpoint ? outpoint.getIndex() : "",
        // When the proof is for an unconfirmed ancestor, path runs from the
        // transaction looked up to that ancestor.
        ancestor: path.length > 1 ? path[path.length - 1] : "",
      };
    },
    // listAddressTransactions summarizes an address's transactions for its
    // page, unconfirmed first, then newest first as bchd returns them, with
    // the address's net change in satoshis. Plain frozen objects keep 10,000
    // transactions cheap for Vue.
    listAddressTransactions: function (addr, addrResult) {
      // bchd gives addresses without their prefix.
      const bare = addr.split(":").pop();
      const net = (tx) => {
        let change = 0;
        tx.getOutputsList().forEach((o) => {
          if (o.getAddress() === bare) {
            change += o.getValue();
          }
        });
        tx.getInputsList().forEach((i) => {
          if (i.getAddress() === bare) {
            change -= i.getValue();
          }
        });
        return change;
      };
      const unconfirmed = addrResult
        .getUnconfirmedTransactionsList()
        .map((m) => ({
          txid: this.convertHash(m.getTransaction().getHash_asU8()),
          height: null,
          timestamp: m.getAddedTime(),
          net: net(m.getTransaction()),
        }));
      const confirmed = addrResult.getConfirmedTransactionsList().map((tx) => ({
        txid: this.convertHash(tx.getHash_asU8()),
        height: tx.getBlockHeight(),
        timestamp: tx.getTimestamp(),
        net: net(tx),
      }));
      return Object.freeze(unconfirmed.concat(confirmed));
    },
    // listUtxos summarizes an address's unspent outputs for its page,
    // unconfirmed first, then newest first.
    listUtxos: function (addrUtxoResult, tokenMetadata) {
      const utxos = addrUtxoResult.getOutputsList().map((u) => {
        const height = u.getBlockHeight();
        const slp = u.getSlpToken();
        let slpLabel = "";
        if (slp) {
          const tm = tokenMetadata.get(
            toHex(slp.getTokenId_asU8())
          );
          slpLabel = slp.getIsMintBaton()
            ? "SLP mint baton"
            : `${Big(slp.getAmount())
                .div(10 ** slp.getDecimals())
                .toFixed()} ${(tm && tm.ticker) || "SLP tokens"}`;
        }
        return {
          txid: this.convertHash(u.getOutpoint().getHash_asU8()),
          vout: u.getOutpoint().getIndex(),
          value: u.getValue(),
          height: height >= UNMINED_HEIGHT ? null : height,
          cash_token: this.parseCashToken(u.getCashToken()),
          slp: slpLabel,
        };
      });
      const rank = (u) => (u.height === null ? Infinity : u.height);
      utxos.sort((a, b) => rank(b) - rank(a));
      return Object.freeze(utxos);
    },
    // parseCashToken turns a pb.CashToken into display data, or undefined
    // when the input or output holds no token.
    parseCashToken: function (ct) {
      if (!ct) {
        return undefined;
      }
      const bitfield = ct.getBitfield_asU8()[0] || 0;
      const token = {
        // Category IDs are txids and display in reversed byte order.
        category: this.convertHash(ct.getCategoryId_asU8()),
        amount: undefined,
        nft: undefined,
      };
      if (bitfield & CASHTOKEN_HAS_AMOUNT) {
        // A string, as uint64 amounts can exceed Number's precision.
        token.amount = ct.getAmount();
      }
      if (bitfield & CASHTOKEN_HAS_NFT) {
        token.nft = {
          capability:
            CASHTOKEN_CAPABILITIES[bitfield & CASHTOKEN_CAPABILITY_MASK] ||
            "unknown",
          commitment: toHex(ct.getCommitment_asU8()),
        };
      }
      return token;
    },
    // summarizeCashTokens totals parsed CashTokens by category.
    summarizeCashTokens: function (tokens) {
      const categories = new Map();
      tokens.forEach((token) => {
        if (!token) {
          return;
        }
        if (!categories.has(token.category)) {
          categories.set(token.category, {
            category: token.category,
            amount: undefined,
            nfts: 0,
            capabilities: { immutable: 0, mutable: 0, minting: 0 },
          });
        }
        const summary = categories.get(token.category);
        if (token.amount !== undefined) {
          summary.amount = (summary.amount || Big(0)).add(token.amount);
        }
        if (token.nft) {
          summary.nfts++;
          if (token.nft.capability in summary.capabilities) {
            summary.capabilities[token.nft.capability]++;
          }
        }
      });
      return Array.from(categories.values());
    },
    resetState: function () {
      this.result = "";
      this.address = "";
      this.addressData = this.defaultAddressData();
      this.block = "";
      this.blockData = this.defaultBlockData();
      this.transaction = "";
      this.transactionData = this.defaultTransactionData();
      this.lookupErrors = [];
    },
    // defaultNodeIndexes is used until the node reports its indexes; null
    // means unknown.
    defaultNodeIndexes: function () {
      return { tx: null, addr: null, slp: null };
    },
    defaultAddressData: function () {
      return {
        balance: 0,
        satoshis: 0,
        utxos: 0,
        legacy: "",
        slp: "",
        token_aware: "",
        confirmed_transactions: 0,
        unconfirmed_transactions: 0,
        tokens: [],
        cashtokens: [],
        transaction_list: [],
        utxo_list: [],
      };
    },
    defaultBlockData: function () {
      return {
        height: 0,
        version: 0,
        previous_block: "",
        merkle_root: "",
        timestamp: 0,
        bits: 0,
        nonce: 0,
        confirmations: 0,
        difficulty: 0,
        next_block_hash: "",
        size: 0,
        median_time: 0,
        transaction_count: 0,
        transactions: [],
      };
    },
    defaultTransactionData: function () {
      return {
        version: 0,
        lock_time: 0,
        size: 0,
        timestamp: 0,
        confirmations: 0,
        block_height: 0,
        block_hash: "",
        inputs: [],
        outputs: [],
        token_metadata: undefined,
        slp_action: 0,
        slp_action_str: "",
        slp_valid: false,
        slp_parse_error: "",
        dsproof_score: null,
        dsproof: null,
        fee: null,
        fee_rate: null,
      };
    },
    updateNetwork: async function () {
      this.resetState();
      // Results of a search on the previous server must not land here.
      this.cancelSearch();
      this.infoResult = "";
      this.tip = { height: null, hash: "" };
      this.recentBlocks = [];
      this.recentBlocksTip = null;
      this.loadingRecent = false;
      this.mempoolStats = null;
      this.mempool = null;
      this.mempoolError = "";
      this.mempoolLoading = false;
      this.mempoolToken++;
      const node = this.nodes.find((n) => n.url === this.selectedNetwork);
      this.network = node ? node.network : MAINNET;
      this.connectingTo = node ? node.name : this.selectedNetwork;
      this.nodeIndexes = this.defaultNodeIndexes();
      const client = this.newGrpcClient();
      this.grpc = client;
      this.connecting = true;
      // Wait for the node to report its network so routes use it.
      await this.getInfo();
      if (client !== this.grpc) {
        // Another server was selected meanwhile; its switch takes over.
        return;
      }
      this.connecting = false;
      if (!this.tip.hash) {
        this.infoResult = "Not connected (select another server)";
      }
      const params = this.$route.params;
      const input = params.address || params.blockHash || params.txId;
      if (input != undefined) {
        this.searchBCHD(input);
      } else if (this.mempoolView) {
        this.loadMempool();
      }
    },
    newGrpcClient: function () {
      return new BchrpcClient({ url: this.selectedNetwork });
    },
    getInfo: async function () {
      const client = this.grpc;
      try {
        var blockInfo = await client.getBlockchainInfo();
        if (client !== this.grpc) {
          // The server was changed while this call was in flight.
          return;
        }
        this.network =
          NETWORK_NAMES[blockInfo.getBitcoinNet()] || this.network;
        this.nodeIndexes = {
          tx: blockInfo.getTxIndex(),
          addr: blockInfo.getAddrIndex(),
          slp: blockInfo.getSlpIndex(),
        };
        this.tip = {
          height: blockInfo.getBestHeight(),
          hash: this.convertHash(blockInfo.getBestBlockHash()),
        };
        if (this.isHome) {
          this.loadRecentBlocks();
          // Cheap, so refreshed with every status poll.
          this.loadMempoolStats();
        }
      } catch {
        // Don't update, could be transient failures.
      }
    },
    convertHash: function (bytes) {
      return Array.from(bytes, function (byte) {
        return ("0" + (byte & 0xff).toString(16)).slice(-2);
      })
        .reverse()
        .join("");
    },
    mapSlpTransactionTypeString: function (type) {
      switch (type) {
        case 0:
          return "NON_SLP";
        case 1:
          return "NON_SLP_BURN";
        case 2:
          return "SLP_PARSE_ERROR";
        case 3:
          return "SLP_UNSUPPORTED_VERSION";
        case 4:
          return "SLP_V1_GENESIS";
        case 5:
          return "SLP_V1_MINT";
        case 6:
          return "SLP_V1_SEND";
        case 7:
          return "SLP_V1_NFT1_GROUP_GENESIS";
        case 8:
          return "SLP_V1_NFT1_GROUP_MINT";
        case 9:
          return "SLP_V1_NFT1_GROUP_SEND";
        case 10:
          return "SLP_V1_NFT1_UNIQUE_CHILD_GENESIS";
        case 11:
          return "SLP_V1_NFT1_UNIQUE_CHILD_SEND";
        default:
          return "unknown type";
      }
    },
    mapBurnFlagToString: function (flags) {
      let flagStr = "";
      flags.forEach((f) => {
        switch (f) {
          case 0:
            flagStr = flagStr + "BURNED_INPUTS_OUTPUTS_TOO_HIGH\n";
            break;
          case 1:
            flagStr = flagStr + "BURNED_INPUTS_BAD_OPRETURN\n";
            break;
          case 2:
            flagStr = flagStr + "BURNED_INPUTS_OTHER_TOKEN\n";
            break;
          case 3:
            flagStr = flagStr + "BURNED_OUTPUTS_MISSING_BCH_VOUT\n";
            break;
          case 4:
            flagStr = flagStr + "BURNED_INPUTS_GREATER_THAN_OUTPUTS\n";
            break;
          default:
            flagStr = flagStr + "unknown burn type\n";
        }
      });
      return flagStr;
    },
  },
  created: function () {
    // Set outside data() so Vue doesn't make the client's internals reactive.
    this.grpc = null;
    // Search bookkeeping that the template never shows.
    this.searchToken = 0;
    this.currentQuery = undefined;
    this.searchingTimer = null;
    this.mempoolToken = 0;
    if (this.getInfoBar) {
      this.getInfo();
      this.infoInterval = setInterval(() => {
        this.getInfo();
      }, 60000);
    }
  },
  beforeUnmount: function () {
    clearInterval(this.infoInterval);
    clearTimeout(this.searchingTimer);
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
[v-cloak] {
  display: none;
}

.logo {
  margin-right: auto;
  margin-left: auto;
  display: block;
  margin-bottom: 1em;
}

/* The home page's mempool table is followed by its link. */
#mempoolstats .table {
  margin-bottom: 0.5em;
}

.mempool-link {
  display: block;
  text-align: right;
}

/* Bulma's .loader is a block; this one sits in a line of text. */
.inline-loader {
  display: inline-block;
  vertical-align: middle;
  margin-right: 0.5em;
}

/* Only the logo itself is clickable, not the whole row. */
.logo-link {
  display: block;
  width: fit-content;
  margin: 0 auto;
}

.info-result {
  margin-top: 0.5em;
}

.results {
  margin-top: 2em;
}

td,
th,
.info-result {
  white-space: -o-pre-wrap;
  word-wrap: break-word;
  white-space: pre-wrap;
  white-space: -moz-pre-wrap;
  white-space: -pre-wrap;
}

table {
  table-layout: fixed;
  width: 100%;
}

footer {
  padding: 0 1em 2em;
}

h2 {
  font-weight: bold;
  font-size: 1.2em;
  margin-bottom: 0.5em;
}
</style>
