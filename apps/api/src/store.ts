import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  assertHexAddress,
  assertTokenSymbol,
  assertValidSlug,
  clampFeeBps,
  DEFAULT_THEME,
  makeId,
  normalizeSlug,
  nowIso,
  type ChainEvent,
  type HexAddress,
  type Launchpad,
  type LaunchpadInput,
  type PopularLaunchpad,
  type StatsShape,
  type TokenLaunch,
  type TokenLaunchInput
} from "../../../packages/shared/src/domain.ts";
import { simulateB20FactoryLaunch, simulateLaunchpadInstanceAddress } from "../../../packages/shared/src/mock-chain.ts";
import { indexEvents } from "./indexer.ts";
import type { AppConfig } from "./config.ts";
import { buildStats, popularLaunchpads } from "./stats.ts";

export interface DatabaseShape {
  nextOnchainLaunchpadId: number;
  launchpads: Launchpad[];
  tokens: TokenLaunch[];
  events: ChainEvent[];
}

const EMPTY_DB: DatabaseShape = {
  nextOnchainLaunchpadId: 1,
  launchpads: [],
  tokens: [],
  events: []
};

export class JsonStore {
  private db: DatabaseShape;
  private readonly filePath: string;
  private readonly statsPath: string;
  private readonly config: AppConfig;

  constructor(config: AppConfig, filePath = resolve(config.dataFile)) {
    this.config = config;
    this.filePath = filePath;
    this.statsPath = resolve(config.statsFile);
    this.db = this.load();
    this.persistStats();
  }

  listLaunchpads(): Launchpad[] {
    return [...this.db.launchpads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getLaunchpadBySlug(slug: string): Launchpad | undefined {
    return this.db.launchpads.find((launchpad) => launchpad.slug === normalizeSlug(slug));
  }

  getLaunchpadById(id: string): Launchpad | undefined {
    return this.db.launchpads.find((launchpad) => launchpad.id === id);
  }

  createLaunchpad(input: LaunchpadInput): Launchpad {
    const slug = normalizeSlug(input.slug || input.name);
    assertValidSlug(slug);
    assertHexAddress(input.ownerWallet, "ownerWallet");

    if (this.getLaunchpadBySlug(slug)) {
      throw new Error(`Launchpad slug "${slug}" is already taken.`);
    }

    const now = nowIso();
    const onchainLaunchpadId = this.db.nextOnchainLaunchpadId++;
    const launchpad: Launchpad = {
      id: makeId("lp", slug),
      onchainLaunchpadId,
      contractAddress: simulateLaunchpadInstanceAddress(onchainLaunchpadId, input.ownerWallet as HexAddress, slug),
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || "A custom B20 launchpad powered by o1.exchange infrastructure.",
      ownerWallet: input.ownerWallet as HexAddress,
      logoUrl: input.logoUrl?.trim() || "",
      bannerUrl: input.bannerUrl?.trim() || "",
      theme: {
        primary: input.primary?.trim() || DEFAULT_THEME.primary,
        accent: input.accent?.trim() || DEFAULT_THEME.accent,
        surface: DEFAULT_THEME.surface
      },
      status: "live",
      additionalFeeBps: clampFeeBps(input.additionalFeeBps),
      createdAt: now,
      updatedAt: now
    };

    this.db.launchpads.push(launchpad);
    this.persist();
    this.persistStats();
    return launchpad;
  }

  updateLaunchpad(id: string, patch: Partial<LaunchpadInput>): Launchpad {
    const launchpad = this.getLaunchpadById(id);
    if (!launchpad) throw new Error("Launchpad not found.");

    if (patch.name != null) launchpad.name = patch.name.trim();
    if (patch.description != null) launchpad.description = patch.description.trim();
    if (patch.logoUrl != null) launchpad.logoUrl = patch.logoUrl.trim();
    if (patch.bannerUrl != null) launchpad.bannerUrl = patch.bannerUrl.trim();
    if (patch.primary != null) launchpad.theme.primary = patch.primary.trim();
    if (patch.accent != null) launchpad.theme.accent = patch.accent.trim();
    if (patch.additionalFeeBps != null) launchpad.additionalFeeBps = clampFeeBps(patch.additionalFeeBps);
    launchpad.updatedAt = nowIso();

    this.persist();
    this.persistStats();
    return launchpad;
  }

  listTokens(launchpadId?: string): TokenLaunch[] {
    const tokens = launchpadId
      ? this.db.tokens.filter((token) => token.launchpadId === launchpadId)
      : this.db.tokens;
    return [...tokens].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  launchToken(input: TokenLaunchInput): TokenLaunch {
    const launchpad = this.getLaunchpadById(input.launchpadId);
    if (!launchpad) throw new Error("Launchpad not found.");
    assertHexAddress(input.creatorWallet, "creatorWallet");
    assertTokenSymbol(input.symbol.trim().toUpperCase());

    const decimals = input.decimals ?? 18;
    if (!Number.isInteger(decimals) || decimals < 6 || decimals > 18) {
      throw new Error("B20 ASSET decimals must be between 6 and 18.");
    }

    const simulated = simulateB20FactoryLaunch({
      onchainLaunchpadId: launchpad.onchainLaunchpadId,
      creatorWallet: input.creatorWallet as HexAddress,
      name: input.name.trim(),
      symbol: input.symbol.trim().toUpperCase(),
      decimals
    });

    this.db.events.push(...simulated.events);
    const indexed = indexEvents(this.db.launchpads, this.db.tokens, simulated.events, {
      initialSupply: input.initialSupply || "0",
      contractURI: input.contractURI || `ipfs://metadata/${input.symbol.trim().toLowerCase()}`
    });
    this.db.tokens = indexed.tokens;
    this.persist();
    this.persistStats();

    const token = this.db.tokens.find((candidate) => candidate.tokenAddress === simulated.token);
    if (!token) throw new Error("Indexer failed to materialize token launch.");
    return token;
  }

  getStats(): { launchpads: number; tokens: number; events: number } {
    return {
      launchpads: this.db.launchpads.length,
      tokens: this.db.tokens.length,
      events: this.db.events.length
    };
  }

  getMaterializedStats(): StatsShape {
    if (!existsSync(this.statsPath)) {
      return this.persistStats();
    }

    return JSON.parse(readFileSync(this.statsPath, "utf8")) as StatsShape;
  }

  listPopularLaunchpads(limit = 5): PopularLaunchpad[] {
    return popularLaunchpads(this.db.launchpads, this.getMaterializedStats(), limit);
  }

  resetDemo(): DatabaseShape {
    this.db = structuredClone(EMPTY_DB);
    this.persist();
    this.persistStats();
    return this.db;
  }

  private load(): DatabaseShape {
    if (!existsSync(this.filePath)) {
      return structuredClone(EMPTY_DB);
    }

    return JSON.parse(readFileSync(this.filePath, "utf8")) as DatabaseShape;
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.db, null, 2));
  }

  private persistStats(): StatsShape {
    const stats = buildStats(this.db.launchpads, this.db.tokens);
    mkdirSync(dirname(this.statsPath), { recursive: true });
    writeFileSync(this.statsPath, JSON.stringify(stats, null, 2));
    return stats;
  }
}
