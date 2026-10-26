
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
    <table class="table is-bordered is-striped" align="center">
      <thead>
        <tr><th colspan="2">{{address}}</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Balance</td>
          <td>{{addressData['balance']}} BCH</td>
        </tr>
        <tr>
          <td>Satoshis</td>
          <td>{{addressData['satoshis']}}</td>
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
          <td>{{addressData['utxos']}}</td>
        </tr>
      </tbody>
    </table>
    <CashTokenAddress :tokens="addressData['cashtokens']" />
    <SLPAddress :tokens="addressData['tokens']" :network="network" />

    <section class="address-list" v-if="addressData['transaction_list'].length">
      <h2>Transactions</h2>
      <p v-if="confirmedListed >= maxListed">
        Only the newest {{maxListed}} confirmed transactions are listed.
      </p>
      <Pager :page="txPage" :pages="pageCount(addressData['transaction_list'])" @change="txPage = $event" />
      <table class="table is-bordered is-striped" align="center">
        <thead>
          <tr>
            <th>Transaction</th>
            <th class="narrow">Block</th>
            <th class="narrow">Time</th>
            <th class="amount">Change</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in pageOf(addressData['transaction_list'], txPage)" :key="tx.txid">
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
      <Pager :page="txPage" :pages="pageCount(addressData['transaction_list'])" @change="txPage = $event" />
    </section>

    <section class="address-list" v-if="addressData['utxo_list'].length">
      <h2>Unspent Outputs</h2>
      <Pager :page="utxoPage" :pages="pageCount(addressData['utxo_list'])" @change="utxoPage = $event" />
      <table class="table is-bordered is-striped" align="center">
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

const PAGE_SIZE = 50;

export default {
  name: "bchaddress",
  props: ["address", "addressData", "network"],
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
      // bchd returns at most this many confirmed transactions.
      maxListed: 10000
    };
  },
  computed: {
    confirmedListed: function() {
      return this.addressData["transaction_list"].filter((tx) => tx.height !== null).length;
    }
  },
  watch: {
    // A new address starts on the first page of each list.
    address: function() {
      this.txPage = 1;
      this.utxoPage = 1;
    }
  },
  methods: {
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

.address-list .table {
  margin-bottom: 0;
}

.narrow {
  width: 8em;
}

.amount {
  width: 12em;
}

.positive {
  color: #257942;
}

.negative {
  color: #cc0f35;
}
</style>