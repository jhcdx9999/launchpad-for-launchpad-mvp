import assert from "node:assert/strict";
import test from "node:test";

import { assertHexAddress, assertTokenSymbol, assertValidSlug, normalizeSlug } from "./domain.ts";

test("normalizeSlug converts a display name into a launchpad-safe slug", () => {
  assert.equal(normalizeSlug("AI Launchpad!!"), "ai-launchpad");
  assert.equal(normalizeSlug("  RWA___Desk  "), "rwa-desk");
});

test("assertValidSlug rejects reserved and malformed slugs", () => {
  assert.throws(() => assertValidSlug("o1"));
  assert.throws(() => assertValidSlug("-bad"));
  assert.doesNotThrow(() => assertValidSlug("ai-launch"));
});

test("address and symbol validation match the MVP API boundary", () => {
  assert.doesNotThrow(() => assertHexAddress("0x1111111111111111111111111111111111111111"));
  assert.throws(() => assertHexAddress("0x123"));
  assert.doesNotThrow(() => assertTokenSymbol("B20AI"));
  assert.throws(() => assertTokenSymbol("too-long-symbol"));
});
