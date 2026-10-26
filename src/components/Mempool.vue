<!--
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
  <div id="mempool">
    <div class="mempool-header">
      <h2>Mempool</h2>
      <span v-if="mempool">
        As of {{formatTime(mempool.asOf)}} &middot;
        <span v-if="loading" role="status"><span class="loader inline-loader"></span>Refreshing&hellip;</span>
        <a v-else href="#" @click.prevent="$emit('refresh')">Refresh</a>
      </span>
    </div>

    <div v-if="!mempool && loading" class="has-text-centered" role="status">
      <span class="loader inline-loader"></span>Loading mempool&hellip;
    </div>
    <div v-else-if="!mempool && error" class="has-text-centered">
      <strong>{{error}}</strong>
    </div>

    <template v-if="mempool">
      <p v-if="error" class="has-text-centered"><strong>{{error}}</strong></p>
      <table class="table is-bordered is-striped" align="center">
        <tbody>
          <tr>
            <td>Unconfirmed Transactions</td>
            <td>{{listLength}}</td>
          </tr>
          <tr>
            <td>Size</td>
            <td>{{prettyBytes(mempool.bytes)}}</td>
          </tr>
          <template v-if="mempool.stats">
            <tr>
              <td>Fee Rate (min / median / max)</td>
              <td>{{mempool.stats.fee_rates}}</td>
            </tr>
            <tr>
              <td>Total Output Value</td>
              <td>{{formatBch(mempool.stats.total_value)}}</td>
            </tr>
            <tr>
              <td>CashToken Transactions</td>
              <td>{{mempool.stats.cashtokens}}</td>
            </tr>
            <tr>
              <td>SLP Transactions</td>
              <td>{{mempool.stats.slp}}</td>
            </tr>
          </template>
        </tbody>
      </table>

      <section class="mempool-proofs" v-if="mempool.proofs !== null">
        <h2>Double Spend Proofs</h2>
        <p v-if="!mempool.proofs.length">None in the mempool.</p>
        <table v-else class="table is-bordered is-striped" align="center">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Double Spent Output</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="proof in mempool.proofs" :key="proof.hash">
              <td><ResultLink type="tx" :value="proof.txid" :label="shortHash(proof.txid)" :network="network" /></td>
              <td><ResultLink type="tx" :value="proof.outpoint_hash" :label="shortHash(proof.outpoint_hash)" :network="network" />:{{proof.outpoint_index}}</td>
              <td>{{shortHash(proof.hash)}}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="mempool-list" v-if="listLength">
        <h2>Transactions</h2>
        <p v-if="mempool.full" class="sort">
          Sort by:
          <template v-for="(option, i) in sortOptions">
            <span :key="option.key + '-sep'" v-if="i > 0"> &middot; </span>
            <strong :key="option.key" v-if="option.key === sort">{{option.label}}</strong>
            <a :key="option.key" v-else href="#" @click.prevent="setSort(option.key)">{{option.label}}</a>
          </template>
        </p>
        <p v-else>
          The mempool is too large to fetch at once, so transactions are in
          the node's order and their details load a page at a time.
        </p>
        <Pager :page="page" :pages="pageCount" @change="page = $event" />
        <table class="table is-bordered is-striped" align="center">
          <thead>
            <tr>
              <th>Transaction</th>
              <th class="narrow">Size</th>
              <th class="narrow">Fee Rate</th>
              <th class="amount">Output Value</th>
              <th class="narrow">Tokens</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pageRows" :key="row.txid">
              <td><ResultLink type="tx" :value="row.txid" :label="shortHash(row.txid)" :network="network" /></td>
              <template v-if="row.details">
                <td>{{prettyBytes(row.details.size)}}</td>
                <td>{{row.details.fee_rate === null ? "" : row.details.fee_rate.toFixed(2) + " sat/B"}}</td>
                <td>{{formatBch(row.details.value)}}</td>
                <td>{{tokenLabel(row.details)}}</td>
              </template>
              <td v-else-if="row.loading" colspan="4" role="status"><span class="loader inline-loader"></span>Loading&hellip;</td>
              <td v-else colspan="4">Details unavailable</td>
            </tr>
          </tbody>
        </table>
        <Pager :page="page" :pages="pageCount" @change="page = $event" />
      </section>
    </template>
  </div>
</template>

<script>
import prettyBytes from "pretty-bytes";
import sb from "satoshi-bitcoin";
import Pager from "./Pager.vue";
import ResultLink from "./ResultLink.vue";
import { formatTime } from "../format";

const PAGE_SIZE = 50;

export default {
  name: "mempool",
  // mempool is the snapshot BCHDExplorer.loadMempool builds. loadDetails
  // fetches summaries for txids when the mempool was too large to fetch
  // whole.
  props: ["mempool", "loading", "error", "network", "loadDetails"],
  components: {
    Pager,
    ResultLink
  },
  data: function() {
    return {
      page: 1,
      sort: "value",
      sortOptions: [
        { key: "value", label: "Output value" },
        { key: "fee_rate", label: "Fee rate" },
        { key: "size", label: "Size" }
      ],
      // Summaries loaded a page at a time, by txid: an object, "loading",
      // or null when the lookup failed.
      details: {}
    };
  },
  computed: {
    listLength: function() {
      return this.mempool.full ? this.mempool.txs.length : this.mempool.hashes.length;
    },
    pageCount: function() {
      return Math.ceil(this.listLength / PAGE_SIZE);
    },
    sortedTxs: function() {
      const key = this.sort;
      const rank = (tx) => (tx[key] === null ? -1 : tx[key]);
      return this.mempool.txs.slice().sort((a, b) => rank(b) - rank(a));
    },
    pageRows: function() {
      const start = (this.page - 1) * PAGE_SIZE;
      if (this.mempool.full) {
        return this.sortedTxs.slice(start, start + PAGE_SIZE).map((tx) => ({ txid: tx.txid, details: tx }));
      }
      return this.mempool.hashes.slice(start, start + PAGE_SIZE).map((txid) => {
        const d = this.details[txid];
        return { txid, details: d && d !== "loading" ? d : null, loading: d === undefined || d === "loading" };
      });
    }
  },
  watch: {
    // A refreshed mempool starts over on the first page.
    mempool: {
      immediate: true,
      handler: function() {
        this.page = 1;
        this.details = {};
        this.fetchPageDetails();
      }
    },
    page: function() {
      this.fetchPageDetails();
    }
  },
  methods: {
    formatTime,
    prettyBytes,
    setSort: function(key) {
      this.sort = key;
      this.page = 1;
    },
    // fetchPageDetails loads the summaries the current page lacks, when the
    // mempool was too large to fetch whole.
    fetchPageDetails: async function() {
      if (!this.mempool || this.mempool.full) {
        return;
      }
      const snapshot = this.mempool;
      const start = (this.page - 1) * PAGE_SIZE;
      const missing = snapshot.hashes.slice(start, start + PAGE_SIZE).filter((txid) => this.details[txid] === undefined);
      if (!missing.length) {
        return;
      }
      missing.forEach((txid) => this.$set(this.details, txid, "loading"));
      const results = await this.loadDetails(missing);
      if (snapshot !== this.mempool) {
        return;
      }
      missing.forEach((txid, i) => this.$set(this.details, txid, results[i]));
    },
    shortHash: function(hash) {
      return `${hash.slice(0, 10)}\u2026${hash.slice(-10)}`;
    },
    formatBch: function(satoshis) {
      return `${sb.toBitcoin(satoshis)} BCH`;
    },
    tokenLabel: function(tx) {
      const parts = [];
      if (tx.cashtoken) {
        parts.push("CashToken");
      }
      if (tx.slp) {
        parts.push("SLP");
      }
      return parts.join(", ");
    }
  }
};
</script>

<style scoped>
.mempool-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.inline-loader {
  display: inline-block;
  vertical-align: middle;
  margin-right: 0.5em;
}

/* Each section has its space after it, whether it ends in a table or a
   line of text. */
.mempool-proofs {
  margin-bottom: 1.5rem;
}

.mempool-proofs .table {
  margin-bottom: 0;
}

/* As on the address page, the bottom pager sits right under the table. */
.mempool-list {
  margin-bottom: 1.5rem;
}

.mempool-list .table {
  margin-bottom: 0;
}

.narrow {
  width: 8em;
}

.amount {
  width: 12em;
}
</style>
