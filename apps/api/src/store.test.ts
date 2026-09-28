import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { AppConfig } from "./config.ts";
import { JsonStore } from "./store.ts";

const ownerWallet = "0x1111111111111111111111111111111111111111";
const creatorWallet = "0x2222222222222222222222222222222222222222";

function testConfig(dir: string): AppConfig {
  return {
    name: "Store Test",
    host: "127.0.0.1",
    port: 0,
    publicAppUrl: "http://127.0.0.1:0",
    publicBaseDomain: "launch.test",
    dataFile: join(dir, "db.json"),
    statsFile: join(dir, "stats.json"),
    adminUsername: "admin",
    adminPassword: "password",
    adminSessionSecret: "session-secret",
    demoOwnerWallet: ownerWallet,
    demoCreatorWallet: creatorWallet
  };
}

test("launchToken defaults empty initial supply to one hundred million", () => {
  const dir = mkdtempSync(join(tmpdir(), "o1-store-"));

  try {
    const store = new JsonStore(testConfig(dir));
    const launchpad = store.createLaunchpad({
      name: "Alpha Launch",
      slug: "alpha",
      ownerWallet
    });

    const token = store.launchToken({
      launchpadId: launchpad.id,
      name: "Alpha Token",
      symbol: "ALPHA",
      creatorWallet
    });

    assert.equal(token.initialSupply, "100000000");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
