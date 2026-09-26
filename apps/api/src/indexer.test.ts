import assert from "node:assert/strict";
import test from "node:test";

import type { ChainEvent, Launchpad } from "../../../packages/shared/src/domain.ts";
import { indexEvents } from "./indexer.ts";

test("indexEvents joins B20Created and TokenLaunched by token address", () => {
  const launchpads: Launchpad[] = [
    {
      id: "lp_ai",
      onchainLaunchpadId: 1,
      contractAddress: "0x3333333333333333333333333333333333333333",
      name: "AI Launch",
      slug: "ai",
      description: "AI launchpad",
      ownerWallet: "0x1111111111111111111111111111111111111111",
      logoUrl: "",
      bannerUrl: "",
      theme: { primary: "#155EEF", accent: "#16A34A", surface: "#F8FAFC" },
      status: "live",
      additionalFeeBps: 50,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ];

  const events: ChainEvent[] = [
    {
      type: "B20Created",
      token: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      variant: "ASSET",
      name: "AI Index",
      symbol: "AIDX",
      decimals: 18,
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      blockNumber: 1
    },
    {
      type: "TokenLaunched",
      launchpadId: 1,
      token: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      creator: "0x2222222222222222222222222222222222222222",
      salt: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      blockNumber: 1
    }
  ];

  const result = indexEvents(launchpads, [], events, {
    initialSupply: "1000",
    contractURI: "ipfs://metadata"
  });

  assert.equal(result.tokens.length, 1);
  assert.equal(result.tokens[0].launchpadId, "lp_ai");
  assert.equal(result.tokens[0].symbol, "AIDX");
});
