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
  <div id="bchablock">
    <nav class="block-nav">
      <ResultLink v-if="blockData['height'] > 0" type="block" :value="blockData['height'] - 1" label="← Previous" :network="network" />
      <span v-else class="disabled">← Previous</span>
      <ResultLink v-if="blockData['next_block_hash']" type="block" :value="blockData['height'] + 1" label="Next →" :network="network" />
      <span v-else class="disabled">Next →</span>
    </nav>
    <table class="table is-bordered is-striped" align="center">
      <thead>
        <tr><th colspan="2">{{block}}</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Height</td>
          <td>{{blockData['height']}}</td>
        </tr>
        <tr>
          <td>Version</td>
          <td>{{blockData['version']}}</td>
        </tr>
        <tr>
          <td>Previous Block</td>
          <td><ResultLink type="block" :value="blockData['previous_block']" :network="network" /></td>
        </tr>
        <tr>
          <td>Merkle Root</td>
          <td>{{blockData['merkle_root']}}</td>
        </tr>
        <tr>
          <td>Timestamp</td>
          <td>{{blockData['timestamp'] ? formatTimeAndAge(blockData['timestamp']) : ''}}</td>
        </tr>
        <tr>
          <td>Bits</td>
          <td>{{blockData['bits']}}</td>
        </tr>
        <tr>
          <td>Nonce</td>
          <td>{{blockData['nonce']}}</td>
        </tr>
        <tr>
          <td>Confirmations</td>
          <td>{{blockData['confirmations']}}</td>
        </tr>
        <tr>
          <td>Difficulty</td>
          <td>{{blockData['difficulty']}}</td>
        </tr>
        <tr>
          <td>Next Block Hash</td>
          <td><ResultLink type="block" :value="blockData['next_block_hash']" :network="network" /></td>
        </tr>
        <tr>
          <td>Size</td>
          <td>{{blockData['size']}}</td>
        </tr>
        <tr>
          <td>Median Time</td>
          <td>{{blockData['median_time'] ? formatTime(blockData['median_time']) : ''}}</td>
        </tr>
      </tbody>
    </table>
    <section class="block-transactions" v-if="blockData['transaction_count']">
      <h2 v-if="blockData['transaction_count'] === 1">1 Transaction</h2>
      <h2 v-else>{{blockData['transaction_count']}} Transactions</h2>
      <Pager :page="txPage" :pages="pageCount" @change="txPage = $event" />
      <table class="table is-bordered is-striped" align="center">
        <thead>
          <tr>
            <th class="tx-index">Index</th>
            <th>Transaction</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(hash, row) in pageTransactions" :key="hash">
            <!-- The position in the block, which page 3 starts at 100. -->
            <td class="tx-index">{{pageStart + row}}{{pageStart + row === 0 ? " (coinbase)" : ""}}</td>
            <td><ResultLink type="tx" :value="hash" :network="network" /></td>
          </tr>
        </tbody>
      </table>
      <Pager :page="txPage" :pages="pageCount" @change="txPage = $event" />
    </section>
  </div>
</template>

<script>
import Pager from "./Pager.vue";
import ResultLink from "./ResultLink.vue";
import { formatTime, formatTimeAndAge } from "../format";

const PAGE_SIZE = 50;

export default {
  name: "bchblock",
  props: ["block", "blockData", "network"],
  components: {
    Pager,
    ResultLink
  },
  data: function() {
    return {
      txPage: 1
    };
  },
  computed: {
    pageCount: function() {
      return Math.ceil(this.blockData["transactions"].length / PAGE_SIZE);
    },
    pageStart: function() {
      return (this.txPage - 1) * PAGE_SIZE;
    },
    pageTransactions: function() {
      return this.blockData["transactions"].slice(this.pageStart, this.pageStart + PAGE_SIZE);
    }
  },
  watch: {
    // A new block starts on the first page.
    block: function() {
      this.txPage = 1;
    }
  },
  methods: {
    formatTime,
    formatTimeAndAge
  }
};
</script>

<style scoped>
@media screen and (min-width: 769px) {
  .tx-index {
    width: 9em;
  }
}

/* On phones the index column fits its contents, leaving the rest to the
   hashes, which may break anywhere. */
@media screen and (max-width: 768px) {
  .block-transactions .table {
    table-layout: auto;
  }

  .block-transactions td:not(.tx-index) {
    overflow-wrap: anywhere;
  }
}

/* The space goes after the list, so the bottom pager sits right under the
   table, as on the address page. */
.block-transactions {
  margin-bottom: 1.5rem;
}

.block-transactions .table {
  margin-bottom: 0;
}

.block-nav {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5em;
}

.disabled {
  color: var(--explorer-disabled);
}
</style>
