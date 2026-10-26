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
  <div id="recentblocks">
    <h2>Recent Blocks</h2>
    <div class="table-container">
      <table class="table is-bordered is-striped" align="center">
        <thead>
          <tr>
            <th class="height">Height</th>
            <th class="age">Age</th>
            <th class="count">Transactions</th>
            <th class="size">Size</th>
            <th>Hash</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="block in blocks" :key="block.hash">
            <td><ResultLink type="block" :value="block.height" :network="network" /></td>
            <td :title="formatTime(block.timestamp)">{{formatAge(block.timestamp)}}</td>
            <td>{{block.transaction_count}}</td>
            <td>{{prettyBytes(block.size)}}</td>
            <td><ResultLink type="block" :value="block.hash" :label="shortHash(block.hash)" :network="network" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import prettyBytes from "pretty-bytes";
import ResultLink from "./ResultLink.vue";
import { formatAge, formatTime } from "../format";
export default {
  name: "recentblocks",
  // blocks are { height, hash, timestamp, transaction_count, size }, newest
  // first.
  props: ["blocks", "network"],
  components: {
    ResultLink
  },
  methods: {
    formatAge,
    formatTime,
    prettyBytes,
    // shortHash keeps both ends of a hash, which is enough to tell blocks
    // apart; the link has the full hash.
    shortHash: function(hash) {
      return `${hash.slice(0, 10)}\u2026${hash.slice(-10)}`;
    }
  }
};
</script>

<style scoped>
/* On phones the columns fit their contents instead (see BCHDExplorer.vue). */
@media screen and (min-width: 769px) {
  .height,
  .count,
  .size {
    width: 8em;
  }

  .age {
    width: 9em;
  }
}
</style>
