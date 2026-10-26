<!--
 Copyright 2020 Coinbase, Inc.

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
        <th colspan="2">{{block}}</th>
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
    <template v-if="blockData['transaction_count']">
      <h2 v-if="blockData['transaction_count'] === 1">1 Transaction</h2>
      <h2 v-else>{{blockData['transaction_count']}} Transactions</h2>
      <p v-if="blockData['transactions'].length < blockData['transaction_count']">
        Showing the first {{blockData['transactions'].length}}.
      </p>
      <table class="table is-bordered is-striped" align="center">
        <tbody>
          <tr v-for="(hash, index) in blockData['transactions']" :key="hash">
            <td class="tx-index">{{index}}</td>
            <td><ResultLink type="tx" :value="hash" :network="network" /></td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script>
import ResultLink from "./ResultLink.vue";
import { formatTime, formatTimeAndAge } from "../format";
export default {
  name: "bchblock",
  props: ["block", "blockData", "network"],
  components: {
    ResultLink
  },
  methods: {
    formatTime,
    formatTimeAndAge
  }
};
</script>

<style scoped>
.tx-index {
  width: 5em;
}

.block-nav {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5em;
}

.disabled {
  color: #b5b5b5;
}
</style>
