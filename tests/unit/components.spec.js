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

import { mount, createLocalVue } from "@vue/test-utils";
import VueRouter from "vue-router";
import Pager from "@/components/Pager.vue";
import ResultLink from "@/components/ResultLink.vue";

function withRouter() {
  const localVue = createLocalVue();
  localVue.use(VueRouter);
  const router = new VueRouter({
    mode: "abstract",
    routes: [
      { name: "home", path: "/" },
      { name: "address", path: "/:network/address/:address" },
      { name: "block", path: "/:network/block/:blockHash" },
      { name: "tx", path: "/:network/tx/:txId" },
    ],
  });
  return { localVue, router };
}

describe("ResultLink", () => {
  it("links to the result's route", () => {
    const tx = mount(ResultLink, {
      ...withRouter(),
      propsData: { type: "tx", value: "ab", network: "mainnet" },
    });
    expect(tx.find("a").attributes("href")).toBe("/mainnet/tx/ab");
    expect(tx.text()).toBe("ab");

    const block = mount(ResultLink, {
      ...withRouter(),
      propsData: { type: "block", value: 0, network: "testnet4", label: "Genesis" },
    });
    expect(block.find("a").attributes("href")).toBe("/testnet4/block/0");
    expect(block.text()).toBe("Genesis");
  });

  it("renders plain text without a value or network", () => {
    const empty = mount(ResultLink, {
      ...withRouter(),
      propsData: { type: "tx", value: "", label: "000", network: "mainnet" },
    });
    expect(empty.find("a").exists()).toBe(false);
    expect(empty.text()).toBe("000");

    const noNetwork = mount(ResultLink, {
      ...withRouter(),
      propsData: { type: "address", value: "qq" },
    });
    expect(noNetwork.find("a").exists()).toBe(false);
  });
});

describe("Pager", () => {
  it("is hidden with one page", () => {
    const pager = mount(Pager, { propsData: { page: 1, pages: 1 } });
    expect(pager.find(".pager").exists()).toBe(false);
  });

  it("offers only the pages that exist", () => {
    const first = mount(Pager, { propsData: { page: 1, pages: 3 } });
    expect(first.text()).toContain("Page 1 of 3");
    const links = first.findAll("a");
    expect(links.length).toBe(1);
    links.at(0).trigger("click");
    expect(first.emitted().change).toEqual([[2]]);

    const last = mount(Pager, { propsData: { page: 3, pages: 3 } });
    last.findAll("a").at(0).trigger("click");
    expect(last.emitted().change).toEqual([[2]]);
  });
});
