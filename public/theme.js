// Copyright 2026 Josh Ellithorpe. Licensed under the Apache License, Version 2.0.
// Applies a saved light or dark theme before the first paint, so the page
// doesn't flash the system theme first. A separate file because the CSP
// blocks inline scripts; src/theme.js uses the same key and values.
try {
  var theme = localStorage.getItem("theme");
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  }
} catch {
  // Storage can be disabled; the system theme applies.
}
