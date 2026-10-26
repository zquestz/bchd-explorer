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

import { readFileSync } from "node:fs";
import { mount } from "@vue/test-utils";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { currentTheme, savedTheme, setTheme } from "@/theme.js";

// stubSystem fakes the system's dark mode setting, which jsdom lacks.
// set(dark) changes it and notifies listeners.
function stubSystem(dark) {
  const listeners = new Set();
  const query = {
    matches: dark,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  window.matchMedia = () => query;
  return {
    listeners,
    set(value) {
      query.matches = value;
      listeners.forEach((fn) => fn({ matches: value }));
    },
  };
}

afterEach(() => {
  delete window.matchMedia;
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("theme", () => {
  it("follows the system setting until a theme is chosen", () => {
    expect(currentTheme()).toBe("light");
    stubSystem(true);
    expect(currentTheme()).toBe("dark");
    expect(savedTheme()).toBe(null);

    setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(savedTheme()).toBe("light");
    expect(currentTheme()).toBe("light");
  });

  it("ignores unknown saved values", () => {
    localStorage.setItem("theme", "sepia");
    expect(savedTheme()).toBe(null);
  });

  it("still switches when storage is disabled", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    expect(savedTheme()).toBe(null);
    setTheme("dark");
    expect(currentTheme()).toBe("dark");
  });

  it("applies a saved theme before the app loads", () => {
    const script = readFileSync("public/theme.js", "utf8");
    localStorage.setItem("theme", "sepia");
    new Function(script)();
    expect(document.documentElement.dataset.theme).toBe(undefined);

    localStorage.setItem("theme", "dark");
    new Function(script)();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("ThemeToggle", () => {
  it("switches the theme and saves the choice", async () => {
    stubSystem(true);
    const toggle = mount(ThemeToggle);
    const button = () => toggle.find("button");
    expect(button().attributes("aria-label")).toBe("Switch to light mode");
    expect(toggle.find(".sun").exists()).toBe(true);

    await button().trigger("click");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(button().attributes("aria-label")).toBe("Switch to dark mode");
    expect(toggle.find(".moon").exists()).toBe(true);

    await button().trigger("click");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("follows system changes until a theme is chosen", async () => {
    const system = stubSystem(false);
    const toggle = mount(ThemeToggle);
    const label = () => toggle.find("button").attributes("aria-label");
    expect(label()).toBe("Switch to dark mode");

    system.set(true);
    await toggle.vm.$nextTick();
    expect(label()).toBe("Switch to light mode");

    await toggle.find("button").trigger("click");
    system.set(true);
    await toggle.vm.$nextTick();
    expect(label()).toBe("Switch to dark mode");

    toggle.unmount();
    expect(system.listeners.size).toBe(0);
  });
});
