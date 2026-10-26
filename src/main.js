/**
 * Copyright 2020 Coinbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import BCHDExplorer from "./components/BCHDExplorer.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { name: "home", path: "/", component: BCHDExplorer },
    { name: "address", path: "/:network/address/:address", component: BCHDExplorer },
    { name: "block", path: "/:network/block/:blockHash", component: BCHDExplorer },
    { name: "tx", path: "/:network/tx/:txId", component: BCHDExplorer },
    { name: "mempool", path: "/:network/mempool", component: BCHDExplorer },
  ],
});

const app = createApp(App);
app.use(router);
// The explorer reads the route when it mounts, so wait for the first one.
router.isReady().then(() => app.mount("#app"));
