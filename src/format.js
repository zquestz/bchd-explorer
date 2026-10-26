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

// formatTime formats Unix seconds as UTC, e.g. "2026-10-25 07:12:03 UTC".
export function formatTime(seconds) {
  return (
    new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 19) +
    " UTC"
  );
}

// formatAge describes how long ago Unix seconds were, e.g. "12 min ago".
export function formatAge(seconds, nowMs = Date.now()) {
  const elapsed = Math.floor(nowMs / 1000) - seconds;
  if (elapsed < 60) {
    // Block timestamps can be a little ahead of the local clock.
    return "just now";
  }
  const units = [
    [86400 * 365, "year"],
    [86400 * 30, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "min"],
  ];
  for (const [size, name] of units) {
    if (elapsed >= size) {
      const count = Math.floor(elapsed / size);
      const unit = name === "min" || count === 1 ? name : name + "s";
      return `${count} ${unit} ago`;
    }
  }
  return "just now";
}

// formatTimeAndAge combines both, e.g. "2026-10-25 07:12:03 UTC (12 min ago)".
export function formatTimeAndAge(seconds, nowMs = Date.now()) {
  return `${formatTime(seconds)} (${formatAge(seconds, nowMs)})`;
}
