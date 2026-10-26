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

<!-- Previous/next page controls; emits "change" with the new page. -->
<template>
  <nav class="pager" v-if="pages > 1">
    <a v-if="page > 1" href="#" @click.prevent="$emit('change', page - 1)">&larr; Previous page</a>
    <span v-else class="disabled">&larr; Previous page</span>
    <span>Page {{page}} of {{pages}}</span>
    <a v-if="page < pages" href="#" @click.prevent="$emit('change', page + 1)">Next page &rarr;</a>
    <span v-else class="disabled">Next page &rarr;</span>
  </nav>
</template>

<script>
export default {
  name: "pager",
  props: ["page", "pages"],
  emits: ["change"]
};
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: space-between;
  margin: 0.5em 0;
}

.disabled {
  color: #b5b5b5;
}
</style>
