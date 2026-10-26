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
  <div id="bchtransaction">
    <table class="table is-bordered is-striped" align="center">
      <thead>
        <tr><th colspan="2">{{transaction}}</th></tr>
      </thead>
      <tbody>
        <tr v-if="transactionData['slp_action'] > 0">
          <td>SLP Validity</td>
          <td>{{transactionData['slp_valid'] ? "Valid" : "Invalid"}}</td>
        </tr>
        <tr v-if="transactionData['slp_action'] > 2">
          <td>SLP Type</td>
          <td>{{transactionData['slp_action_str']}}</td>
        </tr>
        <tr v-if="[1,2].includes(transactionData['slp_action'])">
          <td>SLP Error Type</td>
          <td>{{transactionData['slp_action_str']}}</td>
        </tr>
        <tr v-if="transactionData['slp_action'] === 2" style="color:red;">
          <td>SLP Parser Error</td>
          <td>{{transactionData['slp_parse_error']}}</td>
        </tr>
        <tr v-else-if="transactionData['slp_action'] > 2 && !transactionData['slp_valid']"  style="color:red;">
          <td>SLP Error</td>
          <td>Insufficient inputs</td>
        </tr>
        <tr v-if="transactionData['token_metadata']">
          <td>SLP Token Name</td>
          <td>{{transactionData['token_metadata'].name}}</td>
        </tr>
        <tr v-if="transactionData['token_metadata']">
          <td>SLP Token ID</td>
          <td><ResultLink type="tx" :value="transactionData['token_metadata'].token_id" :network="network" /></td>
        </tr>
        <tr v-if="transactionData['burn_flags']" style="color:red;">
          <td>SLP Burns</td>
          <td>{{transactionData['burn_flags']}}</td>
        </tr>
        <tr v-if="transactionData['burn_amt_this_token']" style="color:red;">
          <td>SLP Inputs Burned (this token)</td>
          <td>{{`${transactionData['burn_amt_this_token']} ${transactionData.token_metadata.ticker}`}}</td>
        </tr>
        <tr v-if="transactionData['burns_from_other_tokens']" style="color:red;">
          <td>SLP Inputs Burned (misc. tokens)</td>
          <td>See inputs below</td>
        </tr>
        <tr v-if="transactionData['slp_action'] === 1">
          <td>SLP Parsing Error</td>
          <td>{{transactionData['slp_parse_error']}}</td>
        </tr>
        <tr v-if="transactionData['token_metadata'] && [10,11].includes(transactionData['slp_action'])">
          <td>SLP Group ID</td>
          <td><ResultLink type="tx" :value="transactionData['token_metadata'].nft_group_id" :network="network" /></td>
        </tr>
        <tr>
          <td>Version</td>
          <td>{{transactionData['version']}}</td>
        </tr>
        <tr>
          <td>Lock Time</td>
          <td>{{transactionData['lock_time']}}</td>
        </tr>
        <tr>
          <td>Size</td>
          <td>{{transactionData['size']}}</td>
        </tr>
        <tr v-if="transactionData['fee'] !== null">
          <td>Fee</td>
          <td>{{transactionData['fee']}} satoshis ({{transactionData['fee_rate']}} sat/B)</td>
        </tr>
        <tr>
          <td>Timestamp</td>
          <!-- bchd gives the block's time, so unconfirmed transactions have none. -->
          <td>{{transactionData['timestamp'] ? formatTimeAndAge(transactionData['timestamp']) : 'Not yet in a block'}}</td>
        </tr>
        <tr>
          <td>Confirmations</td>
          <td>{{transactionData['confirmations']}}</td>
        </tr>
        <tr v-if="transactionData['dsproof_score'] !== null">
          <td>Double Spend Proof Score</td>
          <td>{{dsproofScoreLabel(transactionData['dsproof_score'], transactionData['dsproof'])}}</td>
        </tr>
        <tr v-if="transactionData['dsproof'] === false">
          <td>Double Spend Proof</td>
          <td>None</td>
        </tr>
        <template v-if="transactionData['dsproof']">
          <tr style="color:red;">
            <td>Double Spend Proof</td>
            <td>{{transactionData['dsproof'].hash}}</td>
          </tr>
          <tr style="color:red;">
            <td>Double Spent Output</td>
            <td><ResultLink type="tx" :value="transactionData['dsproof'].outpoint_hash" :network="network" />:{{transactionData['dsproof'].outpoint_index}}</td>
          </tr>
          <tr v-if="transactionData['dsproof'].ancestor" style="color:red;">
            <td>Double Spent Ancestor</td>
            <td><ResultLink type="tx" :value="transactionData['dsproof'].ancestor" :network="network" /></td>
          </tr>
        </template>
        <tr>
          <td>Block Height</td>
          <!-- Unconfirmed transactions report height 0, which isn't their block. -->
          <td><ResultLink type="block" :value="confirmed ? transactionData['block_height'] : ''" :label="String(transactionData['block_height'])" :network="network" /></td>
        </tr>
        <tr>
          <td>Block Hash</td>
          <td><ResultLink type="block" :value="confirmed ? transactionData['block_hash'] : ''" :label="transactionData['block_hash']" :network="network" /></td>
        </tr>
      </tbody>
    </table>
    <h2 v-if="transactionData['inputs'].length === 1">1 Input</h2>
    <h2 v-else>{{transactionData['inputs'].length}} Inputs</h2>
    <table
      class="table is-bordered is-striped"
      align="center"
      v-for="item in transactionData['inputs']"
      v-bind:key="'in-' + item.getIndex()"
    >
      <tbody>
        <tr>
          <td>Index</td>
          <td>{{item.getIndex()}}</td>
        </tr>
        <template v-if="item.cashToken">
          <tr>
            <td>CashToken Category</td>
            <td>{{item.cashToken.category}}</td>
          </tr>
          <tr v-if="item.cashToken.amount !== undefined">
            <td>CashToken Amount</td>
            <td>{{item.cashToken.amount}}</td>
          </tr>
          <tr v-if="item.cashToken.nft">
            <td>CashToken NFT Capability</td>
            <td>{{item.cashToken.nft.capability}}</td>
          </tr>
          <tr v-if="item.cashToken.nft && item.cashToken.nft.commitment">
            <td>CashToken NFT Commitment</td>
            <td>{{item.cashToken.nft.commitment}}</td>
          </tr>
        </template>
        <tr v-if="item.token">
          <td>SLP Token</td>
          <td v-if="!item.token.isBurned">{{item.token.isMintBaton ? "MINT BATON": item.token.amount}} {{item.token.isMintBaton ? "" : item.token.ticker}}</td>
          <td v-else style="color:red;">{{item.token.isMintBaton ? "MINT BATON": item.token.amount}} {{item.token.ticker}} BURNED</td>
        </tr>
        <tr v-if="item.token && item.token.isBurned">
          <td>SLP Token ID Burned</td>
          <td style="color:red;"><ResultLink type="tx" :value="item.token.token_id" :network="network" /></td>
        </tr>
        <tr>
          <td>Outpoint Hash</td>
          <!-- A coinbase input's all-zero outpoint isn't a transaction. -->
          <td><ResultLink type="tx" :value="outpointLink(item)" :label="convertHash(item.getOutpoint().getHash())" :network="network" /></td>
        </tr>
        <tr>
          <td>Outpoint Index</td>
          <td>{{item.getOutpoint().getIndex()}}</td>
        </tr>
        <tr>
          <td>Signature Script</td>
          <td>{{viewScript(item.getSignatureScript_asU8())}}</td>
        </tr>
        <tr>
          <td>Sequence</td>
          <td>{{item.getSequence()}}</td>
        </tr>
        <tr>
          <td>Satoshis</td>
          <td>{{item.getValue()}}</td>
        </tr>
        <tr>
          <td>Previous Script</td>
          <td>{{viewScript(item.getPreviousScript_asU8())}}</td>
        </tr>
        <tr>
          <td>Address</td>
          <td><ResultLink type="address" :value="item.getAddress()" :network="network" /></td>
        </tr>
      </tbody>
    </table>
    <h2 v-if="transactionData['outputs'].length === 1">1 Output</h2>
    <h2 v-else>{{transactionData['outputs'].length}} Outputs</h2>
    <table
      class="table is-bordered is-striped"
      align="center"
      v-for="item in transactionData['outputs']"
      v-bind:key="'out-' + item.getIndex()"
    >
      <tbody>
        <tr>
          <td>Index</td>
          <td>{{item.getIndex()}}</td>
        </tr>
        <template v-if="item.cashToken">
          <tr>
            <td>CashToken Category</td>
            <td>{{item.cashToken.category}}</td>
          </tr>
          <tr v-if="item.cashToken.amount !== undefined">
            <td>CashToken Amount</td>
            <td>{{item.cashToken.amount}}</td>
          </tr>
          <tr v-if="item.cashToken.nft">
            <td>CashToken NFT Capability</td>
            <td>{{item.cashToken.nft.capability}}</td>
          </tr>
          <tr v-if="item.cashToken.nft && item.cashToken.nft.commitment">
            <td>CashToken NFT Commitment</td>
            <td>{{item.cashToken.nft.commitment}}</td>
          </tr>
        </template>
        <tr v-if="item.token">
          <td>SLP Token</td>
          <td>{{item.token.isMintBaton ? "MINT BATON" : item.token.amount}} {{item.token.isMintBaton ? "" : transactionData.token_metadata.ticker}}</td>
        </tr>
        <tr>
          <td>Satoshis</td>
          <td>{{item.getValue()}}</td>
        </tr>
        <tr>
          <td>Pubkey Script</td>
          <td>{{viewScript(item.getPubkeyScript_asU8())}}</td>
        </tr>
        <tr v-if="item.getDisassembledScript()">
          <td>Pubkey Script (ASM)</td>
          <td>{{item.getDisassembledScript()}}</td>
        </tr>
        <tr>
          <td>Address</td>
          <td><ResultLink type="address" :value="item.getAddress()" :network="network" /></td>
        </tr>
        <tr>
          <td>Script Class</td>
          <td>{{item.getScriptClass()}}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import ResultLink from "./ResultLink.vue";
import { formatTimeAndAge } from "../format";
import { toHex } from "../hex";
export default {
  name: "bchtransaction",
  props: ["transaction", "transactionData", "network"],
  components: {
    ResultLink
  },
  computed: {
    confirmed: function() {
      return this.transactionData["confirmations"] > 0;
    }
  },
  methods: {
    formatTimeAndAge,
    // outpointLink returns the transaction an input spends, or "" for a
    // coinbase input, whose outpoint hash is all zeros.
    outpointLink: function(item) {
      const hash = item.getOutpoint().getHash_asU8();
      return hash.every((b) => b === 0) ? "" : this.convertHash(hash);
    },
    // dsproofScoreLabel explains a GetDoubleSpendProofScore result. proof is
    // the proof found, false when there is none, or null when unknown.
    dsproofScoreLabel: function(score, proof) {
      if (score === 1) {
        return "1 (no double spend seen, and every input can get a proof)";
      }
      if (score === 0.25) {
        return "0.25 (some inputs cannot be fully checked)";
      }
      if (score === 0) {
        if (proof) {
          return "0 (double spend detected)";
        }
        if (proof === false) {
          return "0 (spends outputs no proof can cover)";
        }
        return "0 (double spend detected, or outputs no proof can cover)";
      }
      return String(score);
    },
    convertHash: function(bytes) {
      return Array.from(bytes, function(byte) {
        return ("0" + (byte & 0xff).toString(16)).slice(-2);
      })
        .reverse()
        .join("");
    },
    viewScript: toHex
  }
};
</script>