import assert from "node:assert/strict";
import test from "node:test";

import type { Launchpad, TokenLaunch } from "../../../packages/shared/src/domain.ts";
import { buildStats, popularLaunchpads } from "./stats.ts";

const launchpadBase = {
  onchainLaunchpadId: 1,
  contractAddress: "0x3333333333333333333333333333333333333333",
  description: "Launchpad",
  logoUrl: "",
  bannerUrl: "",
  theme: { primary: "#155EEF", accent: "#16A34A", surface: "#F8FAFC" },
  status: "live" as const,
  additionalFeeBps: 50,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const tokenBase = {
  onchainLaunchpadId: 1,
  tokenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  creatorWallet: "0x2222222222222222222222222222222222222222",
  decimals: 18,
  variant: "ASSET" as const,
  initialSupply: "1000000",
  contractURI: "ipfs://metadata",
  txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  salt: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  status: "indexed" as const,
  createdAt: "2026-01-01T00:00:00.000Z"
};

test("buildStats materializes owner and launchpad token counts", () => {
  const launchpads: Launchpad[] = [
    {
      ...launchpadBase,
      id: "lp_ai",
      name: "Alpha Launch",
      slug: "alpha",
      ownerWallet: "0x1111111111111111111111111111111111111111"
    },
    {
      ...launchpadBase,
      id: "lp_meme",
      name: "Beta Launch",
      slug: "beta",
      ownerWallet: "0x1111111111111111111111111111111111111111"
    }
  ];
  const tokens: TokenLaunch[] = [
    { ...tokenBase, id: "tok_alpha_1", launchpadId: "lp_ai", name: "Alpha Index", symbol: "ALPHA" },
    {
      ...tokenBase,
      id: "tok_ai_2",
      launchpadId: "lp_ai",
      name: "Beta Basket",
      symbol: "BETA",
      tokenAddress: "0xdddddddddddddddddddddddddddddddddddddddd"
    }
  ];

  const stats = buildStats(launchpads, tokens);

  assert.equal(stats.launchpads.lp_ai.tokenCount, 2);
  assert.equal(stats.launchpads.lp_meme.tokenCount, 0);
  assert.equal(stats.owners["0x1111111111111111111111111111111111111111"].launchpadCount, 2);
  assert.equal(stats.owners["0x1111111111111111111111111111111111111111"].tokenCount, 2);
  assert.equal(stats.launchpads.lp_ai.topTokens.length, 2);
});

test("popularLaunchpads ranks by token count before market cap", () => {
  const launchpads: Launchpad[] = [
    {
      ...launchpadBase,
      id: "lp_ai",
      name: "Alpha Launch",
      slug: "alpha",
      ownerWallet: "0x1111111111111111111111111111111111111111"
    },
    {
      ...launchpadBase,
      id: "lp_meme",
      name: "Beta Launch",
      slug: "beta",
      ownerWallet: "0x2222222222222222222222222222222222222222"
    }
  ];
  const tokens: TokenLaunch[] = [
    { ...tokenBase, id: "tok_alpha", launchpadId: "lp_ai", name: "Alpha Index", symbol: "ALPHA" },
    {
      ...tokenBase,
      id: "tok_meme_1",
      launchpadId: "lp_meme",
      name: "Beta One",
      symbol: "BETA1",
      tokenAddress: "0xdddddddddddddddddddddddddddddddddddddddd"
    },
    {
      ...tokenBase,
      id: "tok_meme_2",
      launchpadId: "lp_meme",
      name: "Beta Two",
      symbol: "BETA2",
      tokenAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
    }
  ];

  const ranked = popularLaunchpads(launchpads, buildStats(launchpads, tokens));

  assert.equal(ranked[0].launchpad.id, "lp_meme");
  assert.equal(ranked[0].stats.tokenCount, 2);
});
