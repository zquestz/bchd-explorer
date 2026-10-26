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
  css: {
    preprocessorOptions: {
      // Bulma 1.0.4's Sass uses syntax that current Sass deprecates.
      scss: { quietDeps: true },
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
    rolldownOptions: {
      output: {
        // Libraries change less often than the app, so they get their own
        // chunks that browsers keep cached across deploys. The gRPC bindings
        // are most of the download (about 375 kB), so they're split from
        // the rest.
        codeSplitting: {
          groups: [
            {
              name: "bchrpc",
              test: /[\\/]vendor[\\/]bchrpc-pb[\\/]|[\\/]node_modules[\\/](google-protobuf|@improbable-eng)[\\/]/,
              priority: 2,
            },
            {
              name: "vendor",
              test: /[\\/]node_modules[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    // describe, it and expect without imports, as under Jest.
    globals: true,
    include: ["tests/unit/**/*.spec.js"],
  },
});
