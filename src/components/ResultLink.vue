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

<!-- A link to another result. The route change runs its search. -->
<template>
  <router-link v-if="to" :to="to">{{label || value}}</router-link>
  <span v-else>{{label || value}}</span>
</template>

<script>
const ROUTES = {
  tx: ["tx", "txId"],
  block: ["block", "blockHash"],
  address: ["address", "address"],
};

export default {
  name: "resultlink",
  // type is "tx", "block" or "address". label, when set, is shown instead
  // of value.
  props: ["type", "value", "network", "label"],
  computed: {
    to: function() {
      const route = ROUTES[this.type];
      if (!route || !this.network || this.value === "" || this.value === undefined || this.value === null) {
        return null;
      }
      return {
        name: route[0],
        params: { network: this.network, [route[1]]: String(this.value) }
      };
    }
  }
};
</script>
