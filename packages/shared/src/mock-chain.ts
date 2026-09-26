import { createHash, randomBytes } from "node:crypto";

import type { B20CreatedEvent, B20Variant, HexAddress, TokenLaunchedEvent } from "./domain.ts";

export interface SimulatedLaunchArgs {
  onchainLaunchpadId: number;
  creatorWallet: HexAddress;
  name: string;
  symbol: string;
  decimals: number;
  variant?: B20Variant;
}

function toHex(bytes: Buffer): HexAddress {
  return `0x${bytes.toString("hex")}`;
}

export function deterministicHex(seed: string, bytes: number): HexAddress {
  return toHex(createHash("sha256").update(seed).digest().subarray(0, bytes));
}

export function randomTxHash(): HexAddress {
  return toHex(randomBytes(32));
}

export function simulateB20FactoryLaunch(args: SimulatedLaunchArgs): {
  token: HexAddress;
  salt: HexAddress;
  txHash: HexAddress;
  events: [B20CreatedEvent, TokenLaunchedEvent];
} {
  const variant = args.variant ?? "ASSET";
  const salt = deterministicHex(
    `${args.onchainLaunchpadId}:${args.creatorWallet}:${args.symbol}:${Date.now()}`,
    32
  );
  const token = deterministicHex(`b20:${variant}:${args.creatorWallet}:${salt}`, 20);
  const txHash = randomTxHash();
  const blockNumber = Math.floor(Date.now() / 1000);

  return {
    token,
    salt,
    txHash,
    events: [
      {
        type: "B20Created",
        token,
        variant,
        name: args.name,
        symbol: args.symbol,
        decimals: args.decimals,
        txHash,
        blockNumber
      },
      {
        type: "TokenLaunched",
        launchpadId: args.onchainLaunchpadId,
        token,
        creator: args.creatorWallet,
        salt,
        txHash,
        blockNumber
      }
    ]
  };
}

export function simulateLaunchpadInstanceAddress(onchainLaunchpadId: number, ownerWallet: HexAddress, slug: string): HexAddress {
  return deterministicHex(`launchpad-instance:${onchainLaunchpadId}:${ownerWallet}:${slug}`, 20);
}
