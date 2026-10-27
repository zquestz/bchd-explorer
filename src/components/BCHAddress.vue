
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
  <div id="bchaddress">
    <table class="table is-bordered is-striped">
      <thead>
        <tr><th colspan="2">{{address}}</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Balance</td>
          <td v-if="addressData['utxos_loading']" role="status"><span class="loader inline-loader"></span>Loading&hellip;</td>
          <td v-else-if="addressData['utxo_error']">Unavailable</td>
          <td v-else>{{addressData['balance']}} BCH</td>
        </tr>
        <tr>
          <td>Satoshis</td>
          <td v-if="addressData['utxos_loading']"><span class="loader inline-loader"></span>Loading&hellip;</td>
          <td v-else-if="addressData['utxo_error']">Unavailable</td>
          <td v-else>{{addressData['satoshis']}}</td>
        </tr>
        <tr>
          <td>Legacy Address</td>
          <td>{{addressData['legacy']}}</td>
        </tr>
        <tr>
          <td>Cash Address</td>
          <td>{{addressData['cash']}}</td>
        </tr>
        <tr v-if="addressData['token_aware']">
          <td>Token-Aware Address</td>
          <td>{{addressData['token_aware']}}</td>
        </tr>
        <tr>
          <td>Slp Address</td>
          <td>{{addressData['slp']}}</td>
        </tr>
        <tr>
          <td>Confirmed Transactions</td>
          <td>{{addressData['confirmed_transactions']}}</td>
        </tr>
        <tr>
          <td>Unconfirmed Transactions</td>
          <td>{{addressData['unconfirmed_transactions']}}</td>
        </tr>
        <tr>
          <td>UTXOs</td>
          <td v-if="addressData['utxos_loading']"><span class="loader inline-loader"></span>Loading&hellip;</td>
          <td v-else-if="addressData['utxo_error']">Unavailable</td>
          <td v-else>{{addressData['utxos']}}</td>
        </tr>
      </tbody>
    </table>
    <CashTokenAddress :tokens="addressData['cashtokens']" />
    <SLPAddress :tokens="addressData['tokens']" :network="network" />

    <section class="address-list" v-if="hasTransactions">
      <h2>Transactions</h2>
      <Pager :page="txPage" :pages="txPages" :more="txMore" @change="txPage = $event" />
      <div class="table-container">
        <table class="table is-bordered is-striped">
          <thead>
            <tr>
              <th>Transaction</th>
              <th class="narrow">Block</th>
              <th class="narrow">Time</th>
              <th class="amount">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!currentTxPage || currentTxPage.loading" role="status">
              <td colspan="4"><span class="loader inline-loader"></span>Loading&hellip;</td>
            </tr>
            <tr v-else-if="currentTxPage.error">
              <td colspan="4">Couldn't load these transactions.</td>
            </tr>
            <tr v-for="tx in txRows" :key="tx.txid">
              <td><ResultLink type="tx" :value="tx.txid" :label="shortHash(tx.txid)" :network="network" /></td>
              <td>
                <ResultLink v-if="tx.height !== null" type="block" :value="tx.height" :network="network" />
                <span v-else>Unconfirmed</span>
              </td>
              <td :title="tx.timestamp ? formatTime(tx.timestamp) : ''">{{tx.timestamp ? formatAge(tx.timestamp) : ''}}</td>
              <td :class="tx.net < 0 ? 'negative' : 'positive'">{{formatChange(tx.net)}}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pager :page="txPage" :pages="txPages" :more="txMore" @change="txPage = $event" />
    </section>

    <section class="address-list" v-if="addressData['utxos_loading'] || addressData['utxo_error']">
      <h2>Unspent Outputs</h2>
      <p v-if="addressData['utxos_loading']" role="status"><span class="loader inline-loader"></span>Loading unspent outputs&hellip;</p>
      <p v-else><strong>{{addressData['utxo_error']}}</strong></p>
    </section>
    <section class="address-list" v-else-if="addressData['utxo_list'].length">
      <h2>Unspent Outputs</h2>
      <Pager :page="utxoPage" :pages="pageCount(addressData['utxo_list'])" @change="utxoPage = $event" />
      <div class="table-container">
        <table class="table is-bordered is-striped">
          <thead>
            <tr>
              <th>Output</th>
              <th class="narrow">Block</th>
              <th class="amount">Value</th>
              <th>Token</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="utxo in pageOf(addressData['utxo_list'], utxoPage)" :key="utxo.txid + ':' + utxo.vout">
              <td><ResultLink type="tx" :value="utxo.txid" :label="shortHash(utxo.txid)" :network="network" />:{{utxo.vout}}</td>
              <td>
                <ResultLink v-if="utxo.height !== null" type="block" :value="utxo.height" :network="network" />
                <span v-else>Unconfirmed</span>
              </td>
              <td>{{formatBch(utxo.value)}}</td>
              <td>{{tokenLabel(utxo)}}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pager :page="utxoPage" :pages="pageCount(addressData['utxo_list'])" @change="utxoPage = $event" />
    </section>
  </div>
</template>

<script>
import sb from "satoshi-bitcoin";
import SLPAddress from "./SLPAddress.vue";
import CashTokenAddress from "./CashTokenAddress.vue";
import Pager from "./Pager.vue";
import ResultLink from "./ResultLink.vue";
import { formatAge, formatTime } from "../format";

// The rows on a page of each list. BCHDExplorer fetches the transactions a
// page at a time, and a full page tells there may be more.
export const PAGE_SIZE = 50;

export default {
  name: "bchaddress",
  // loadTransactions(page) resolves to a page of the address's transactions
  // as BCHDExplorer.fetchAddressPage gives it; addressData.transaction_page
  // holds the first.
  props: ["address", "addressData", "network", "loadTransactions"],
  components: {
    SLPAddress,
    CashTokenAddress,
    Pager,
    ResultLink
  },
  data: function() {
    return {
      txPage: 1,
      utxoPage: 1,
      // The pages of transactions fetched, by number: a page, or
      // { loading: true } or { error: true }.
      txPageCache: {},
      // Replies for pages asked for before the address or its first page
      // last changed are dropped.
      txToken: 0
    };
  },
  computed: {
    firstTxPage: function() {
      return this.addressData["transaction_page"];
    },
    hasTransactions: function() {
      const first = this.firstTxPage;
      return !!first && (first.unconfirmed.length > 0 || first.confirmed.length > 0);
    },
    // txPages is the number of pages of transactions, or null when the node
    // predates the count, which it then leaves 0 although the address has
    // transactions.
    txPages: function() {
      const count = this.addressData["confirmed_transactions"];
      if (count > 0) {
        return Math.ceil(count / PAGE_SIZE);
      }
      return this.firstTxPage && this.firstTxPage.confirmed.length > 0 ? null : 1;
    },
    // txMore tells, without a count, whether there may be a next page: the
    // current one is full.
    txMore: function() {
      const page = this.currentTxPage;
      return !!page && !!page.confirmed && page.confirmed.length === PAGE_SIZE;
    },
    currentTxPage: function() {
      return this.txPageCache[this.txPage];
    },
    // txRows lists the current page's transactions, the unconfirmed ones
    // first on the first page.
    txRows: function() {
      const page = this.currentTxPage;
      if (!page || !page.confirmed) {
        return [];
      }
      return this.txPage === 1 ? page.unconfirmed.concat(page.confirmed) : page.confirmed;
    }
  },
  watch: {
    // A new address starts on the first page of each list.
    address: function() {
      this.utxoPage = 1;
    },
    // A new first page, for a new address or the same one searched again,
    // starts the transactions over.
    firstTxPage: {
      immediate: true,
      handler: function(first) {
        this.txToken++;
        this.txPage = 1;
        this.txPageCache = first ? { 1: first } : {};
        this.prefetchNext();
      }
    },
    txPage: function() {
      this.showTxPage();
    }
  },
  methods: {
    // showTxPage fetches the current page unless it is fetched or being
    // fetched, then the next.
    showTxPage: async function() {
      const page = this.txPage;
      const cached = this.txPageCache[page];
      if (!cached || cached.error) {
        await this.fetchTxPage(page);
      }
      if (page === this.txPage) {
        this.prefetchNext();
      }
    },
    // prefetchNext fetches the page after the current one in the background,
    // so that moving to it is usually instant.
    prefetchNext: function() {
      const next = this.txPage + 1;
      const more = this.txPages === null ? this.txMore : next <= this.txPages;
      if (more && !this.txPageCache[next]) {
        this.fetchTxPage(next);
      }
    },
    fetchTxPage: async function(page) {
      if (!this.loadTransactions) {
        return;
      }
      const token = this.txToken;
      this.txPageCache[page] = { loading: true };
      let result;
      try {
        result = await this.loadTransactions(page);
      } catch {
        result = { error: true };
      }
      if (token === this.txToken) {
        this.txPageCache[page] = result;
      }
    },
    formatAge,
    formatTime,
    pageCount: function(list) {
      return Math.ceil(list.length / PAGE_SIZE);
    },
    pageOf: function(list, page) {
      return list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    },
    shortHash: function(hash) {
      return `${hash.slice(0, 10)}\u2026${hash.slice(-10)}`;
    },
    formatBch: function(satoshis) {
      return `${sb.toBitcoin(satoshis)} BCH`;
    },
    formatChange: function(satoshis) {
      return `${satoshis > 0 ? "+" : ""}${sb.toBitcoin(satoshis)} BCH`;
    },
    // tokenLabel describes the tokens an unspent output holds.
    tokenLabel: function(utxo) {
      const parts = [];
      const ct = utxo.cash_token;
      if (ct && ct.amount !== undefined) {
        parts.push(`${ct.amount} CashTokens`);
      }
      if (ct && ct.nft) {
        parts.push(`CashToken NFT (${ct.nft.capability})`);
      }
      if (utxo.slp) {
        parts.push(utxo.slp);
      }
      return parts.join(", ");
    }
  }
};
</script>

<style scoped>
/* The space goes after each list, so the bottom pager sits right under its
   table instead of after Bulma's table margin. */
.address-list {
  margin-bottom: 1.5rem;
}

.address-list .table-container {
  margin-bottom: 0;
}

/* On phones the columns fit their contents instead (see BCHDExplorer.vue). */
@media screen and (min-width: 769px) {
  .narrow {
    width: 8em;
  }

  .amount {
    width: 12em;
  }
}

.positive {
  color: var(--bulma-success-on-scheme);
}

.negative {
  color: var(--bulma-danger-on-scheme);
}
</style>