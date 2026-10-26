/**
 * Copyright 2026 Josh Ellithorpe
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

import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // bchrpc-pb is a linked local package of CommonJS files. Linked packages
  // aren't pre-bundled or converted to ES modules unless listed here.
  optimizeDeps: {
    include: ["bchrpc-pb/bchrpc_pb", "bchrpc-pb/bchrpc_pb_service"],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /vendor\/bchrpc-pb/],
    },
  },
  test: {
    environment: "jsdom",
    // describe, it and expect without imports, as under Jest.
    globals: true,
    include: ["tests/unit/**/*.spec.js"],
  },
});
