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

// The light or dark theme. Bulma follows the system setting unless <html>
// has data-theme, which a saved choice sets. public/theme.js applies the
// saved choice before the first paint; keep its key and values in step.
const STORAGE_KEY = "theme";
const THEMES = ["light", "dark"];
const DARK_QUERY = "(prefers-color-scheme: dark)";

function darkQuery() {
  return typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
}

// savedTheme returns the theme the user chose, or null.
export function savedTheme() {
  try {
    const theme = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(theme) ? theme : null;
  } catch {
    // Storage can be disabled.
    return null;
  }
}

// currentTheme returns the theme shown: the chosen one, else the system's.
export function currentTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (THEMES.includes(chosen)) {
    return chosen;
  }
  const query = darkQuery();
  return query && query.matches ? "dark" : "light";
}

// setTheme shows theme and saves it as the user's choice.
export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Still applies for this page.
  }
}

// onSystemThemeChange calls fn when the system setting changes, and returns
// a function that stops it.
export function onSystemThemeChange(fn) {
  const query = darkQuery();
  if (!query) {
    return () => {};
  }
  query.addEventListener("change", fn);
  return () => query.removeEventListener("change", fn);
}
