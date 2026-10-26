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

<!-- Switches between the light and dark themes, showing the one it turns on. -->
<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="label"
    :title="label"
    @click="toggle"
  >
    <svg v-if="theme === 'light'" class="moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
    <svg v-else class="sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  </button>
</template>

<script>
import { currentTheme, onSystemThemeChange, setTheme } from "../theme.js";

export default {
  name: "themetoggle",
  data: function () {
    return { theme: currentTheme() };
  },
  computed: {
    label: function () {
      return this.theme === "light" ? "Switch to dark mode" : "Switch to light mode";
    },
  },
  mounted() {
    // Until the user chooses, the theme follows the system setting.
    this.stopWatching = onSystemThemeChange(() => {
      this.theme = currentTheme();
    });
  },
  beforeUnmount() {
    this.stopWatching();
  },
  methods: {
    toggle: function () {
      this.theme = this.theme === "light" ? "dark" : "light";
      setTheme(this.theme);
    },
  },
};
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2em;
  height: 2em;
  margin-right: 0.5em;
  padding: 0;
  vertical-align: middle;
  color: var(--bulma-text);
  background: none;
  border: 1px solid var(--bulma-border);
  border-radius: var(--bulma-radius);
  cursor: pointer;
}

.theme-toggle:hover {
  color: var(--bulma-text-strong);
  border-color: var(--bulma-text-weak);
}
</style>
