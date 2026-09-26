import { makeId, nowIso, type ChainEvent, type Launchpad, type TokenLaunch } from "../../../packages/shared/src/domain.ts";

interface MaterializationContext {
  initialSupply: string;
  contractURI: string;
}

export function indexEvents(
  launchpads: Launchpad[],
  existingTokens: TokenLaunch[],
  events: ChainEvent[],
  context: MaterializationContext
): { tokens: TokenLaunch[] } {
  const tokens = [...existingTokens];
  const b20ByToken = new Map(events.filter((event) => event.type === "B20Created").map((event) => [event.token, event]));
  const attributionEvents = events.filter((event) => event.type === "TokenLaunched");

  for (const attribution of attributionEvents) {
    if (tokens.some((token) => token.tokenAddress === attribution.token)) continue;

    const b20 = b20ByToken.get(attribution.token);
    if (!b20) continue;

    const launchpad = launchpads.find((candidate) => candidate.onchainLaunchpadId === attribution.launchpadId);
    if (!launchpad) continue;

    tokens.push({
      id: makeId("token", attribution.token),
      launchpadId: launchpad.id,
      onchainLaunchpadId: launchpad.onchainLaunchpadId,
      tokenAddress: attribution.token,
      creatorWallet: attribution.creator,
      name: b20.name,
      symbol: b20.symbol,
      decimals: b20.decimals,
      variant: b20.variant,
      initialSupply: context.initialSupply,
      contractURI: context.contractURI,
      txHash: attribution.txHash,
      salt: attribution.salt,
      status: "indexed",
      createdAt: nowIso()
    });
  }

  return { tokens };
}
