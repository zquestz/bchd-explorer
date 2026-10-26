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

import { formatAge, formatTime, formatTimeAndAge } from "@/format";

const NOW_S = 1761364800; // 2025-10-25 04:00:00 UTC
const NOW_MS = NOW_S * 1000;

describe("format", () => {
  it("formats times in UTC", () => {
    expect(formatTime(NOW_S)).toBe("2025-10-25 04:00:00 UTC");
    expect(formatTime(0)).toBe("1970-01-01 00:00:00 UTC");
  });

  it("describes ages", () => {
    expect(formatAge(NOW_S - 5, NOW_MS)).toBe("just now");
    // Block times can be a little ahead of the local clock.
    expect(formatAge(NOW_S + 30, NOW_MS)).toBe("just now");
    expect(formatAge(NOW_S - 60, NOW_MS)).toBe("1 min ago");
    expect(formatAge(NOW_S - 12 * 60, NOW_MS)).toBe("12 min ago");
    expect(formatAge(NOW_S - 3600, NOW_MS)).toBe("1 hour ago");
    expect(formatAge(NOW_S - 5 * 3600, NOW_MS)).toBe("5 hours ago");
    expect(formatAge(NOW_S - 86400, NOW_MS)).toBe("1 day ago");
    expect(formatAge(NOW_S - 45 * 86400, NOW_MS)).toBe("1 month ago");
    expect(formatAge(NOW_S - 800 * 86400, NOW_MS)).toBe("2 years ago");
  });

  it("combines both", () => {
    expect(formatTimeAndAge(NOW_S - 120, NOW_MS)).toBe(
      "2025-10-25 03:58:00 UTC (2 min ago)"
    );
  });
});
