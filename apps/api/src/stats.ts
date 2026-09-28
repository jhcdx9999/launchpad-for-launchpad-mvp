import {
  nowIso,
  type Launchpad,
  type LaunchpadStats,
  type OwnerLaunchpadStats,
  type PopularLaunchpad,
  type StatsShape,
  type TokenLaunch,
  type TokenMarketMetrics
} from "../../../packages/shared/src/domain.ts";

export function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function tokenMarketMetrics(token: TokenLaunch): TokenMarketMetrics {
  const seed = hashText(`${token.tokenAddress}:${token.symbol}`);
  const parsedSupply = Number.parseFloat(String(token.initialSupply || "0").replace(/,/g, ""));
  const supply = Number.isFinite(parsedSupply) && parsedSupply > 0 ? Math.min(parsedSupply, 1_000_000_000) : 1_000_000;
  const price = ((seed % 450) + 50) / 100;
  const marketCap = Math.round(supply * price);
  const volumeRatio = (((seed >>> 8) % 18) + 6) / 100;
  return {
    marketCap,
    volume24h: Math.round(marketCap * volumeRatio)
  };
}

export function buildStats(launchpads: Launchpad[], tokens: TokenLaunch[]): StatsShape {
  const updatedAt = nowIso();
  const tokensByLaunchpad = new Map<string, TokenLaunch[]>();

  for (const token of tokens) {
    const launchpadTokens = tokensByLaunchpad.get(token.launchpadId) || [];
    launchpadTokens.push(token);
    tokensByLaunchpad.set(token.launchpadId, launchpadTokens);
  }

  const launchpadStats: Record<string, LaunchpadStats> = {};
  const ownerStats: Record<string, OwnerLaunchpadStats> = {};

  for (const launchpad of launchpads) {
    const launchpadTokens = tokensByLaunchpad.get(launchpad.id) || [];
    const topTokens = launchpadTokens
      .map((token) => ({ token, metrics: tokenMarketMetrics(token) }))
      .sort((a, b) => b.metrics.marketCap - a.metrics.marketCap)
      .slice(0, 3)
      .map(({ token, metrics }) => ({
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        tokenAddress: token.tokenAddress,
        marketCap: metrics.marketCap,
        volume24h: metrics.volume24h
      }));

    const aggregate = launchpadTokens.reduce(
      (summary, token) => {
        const metrics = tokenMarketMetrics(token);
        summary.marketCap += metrics.marketCap;
        summary.volume24h += metrics.volume24h;
        return summary;
      },
      { marketCap: 0, volume24h: 0 }
    );

    const stats: LaunchpadStats = {
      launchpadId: launchpad.id,
      ownerWallet: launchpad.ownerWallet,
      tokenCount: launchpadTokens.length,
      marketCap: aggregate.marketCap,
      volume24h: aggregate.volume24h,
      topTokens,
      updatedAt
    };
    launchpadStats[launchpad.id] = stats;

    const existingOwner = ownerStats[launchpad.ownerWallet] || {
      ownerWallet: launchpad.ownerWallet,
      launchpadCount: 0,
      tokenCount: 0,
      marketCap: 0,
      volume24h: 0,
      launchpadIds: []
    };
    existingOwner.launchpadCount += 1;
    existingOwner.tokenCount += stats.tokenCount;
    existingOwner.marketCap += stats.marketCap;
    existingOwner.volume24h += stats.volume24h;
    existingOwner.launchpadIds.push(launchpad.id);
    ownerStats[launchpad.ownerWallet] = existingOwner;
  }

  return {
    updatedAt,
    launchpads: launchpadStats,
    owners: ownerStats
  };
}

export function popularLaunchpads(
  launchpads: Launchpad[],
  stats: StatsShape,
  limit = 5
): PopularLaunchpad[] {
  return [...launchpads]
    .map((launchpad) => ({ launchpad, stats: stats.launchpads[launchpad.id] }))
    .filter((item): item is PopularLaunchpad => Boolean(item.stats))
    .sort((a, b) => {
      const tokenCountDiff = b.stats.tokenCount - a.stats.tokenCount;
      if (tokenCountDiff !== 0) return tokenCountDiff;
      const marketCapDiff = b.stats.marketCap - a.stats.marketCap;
      if (marketCapDiff !== 0) return marketCapDiff;
      const volumeDiff = b.stats.volume24h - a.stats.volume24h;
      if (volumeDiff !== 0) return volumeDiff;
      return a.launchpad.name.localeCompare(b.launchpad.name);
    })
    .slice(0, limit);
}
