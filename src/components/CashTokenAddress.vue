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
  <div id="cashtokenaddress">
    <h2 v-if="tokens.length">CashToken Balances</h2>
    <div v-for="token in tokens" :key="token.category">
      <table class="table is-bordered is-striped">
        <tbody>
          <tr>
            <td>Category</td>
            <td>{{token.category}}</td>
          </tr>
          <tr v-if="token.amount !== undefined">
            <td>Fungible Balance</td>
            <td>{{token.amount.toFixed()}}</td>
          </tr>
          <tr v-if="token.nfts">
            <td>NFTs</td>
            <td>{{nftSummary(token)}}</td>
          </tr>
        </tbody>
      </table>
      <br>
    </div>
  </div>
</template>

<script>
export default {
  name: "cashtokenaddress",
  props: ["tokens"],
  methods: {
    // nftSummary gives the NFT count with its capabilities,
    // e.g. "3 (2 immutable, 1 minting)".
    nftSummary: function(token) {
      const parts = Object.entries(token.capabilities)
        .filter(([, count]) => count > 0)
        .map(([capability, count]) => `${count} ${capability}`);
      return `${token.nfts} (${parts.join(", ")})`;
    }
  }
};
</script>
