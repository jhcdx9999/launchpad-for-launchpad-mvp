export type HexAddress = `0x${string}`;

export type LaunchpadStatus = "draft" | "live" | "suspended";

export interface ThemeConfig {
  primary: string;
  accent: string;
  surface: string;
}

export interface Launchpad {
  id: string;
  onchainLaunchpadId: number;
  contractAddress: HexAddress;
  name: string;
  slug: string;
  description: string;
  ownerWallet: HexAddress;
  logoUrl: string;
  bannerUrl: string;
  theme: ThemeConfig;
  status: LaunchpadStatus;
  additionalFeeBps: number;
  createdAt: string;
  updatedAt: string;
}

export type B20Variant = "ASSET" | "STABLECOIN";

export interface TokenLaunch {
  id: string;
  launchpadId: string;
  onchainLaunchpadId: number;
  tokenAddress: HexAddress;
  creatorWallet: HexAddress;
  name: string;
  symbol: string;
  decimals: number;
  variant: B20Variant;
  initialSupply: string;
  contractURI: string;
  txHash: HexAddress;
  salt: HexAddress;
  status: "indexed" | "pending";
  createdAt: string;
}

export interface B20CreatedEvent {
  type: "B20Created";
  token: HexAddress;
  variant: B20Variant;
  name: string;
  symbol: string;
  decimals: number;
  txHash: HexAddress;
  blockNumber: number;
}

export interface TokenLaunchedEvent {
  type: "TokenLaunched";
  launchpadId: number;
  token: HexAddress;
  creator: HexAddress;
  salt: HexAddress;
  txHash: HexAddress;
  blockNumber: number;
}

export type ChainEvent = B20CreatedEvent | TokenLaunchedEvent;

export interface LaunchpadInput {
  name: string;
  slug: string;
  description?: string;
  ownerWallet: string;
  logoUrl?: string;
  bannerUrl?: string;
  primary?: string;
  accent?: string;
  additionalFeeBps?: number;
}

export interface TokenLaunchInput {
  launchpadId: string;
  name: string;
  symbol: string;
  decimals?: number;
  creatorWallet: string;
  initialSupply?: string;
  contractURI?: string;
}

export const DEFAULT_THEME: ThemeConfig = {
  primary: "#155EEF",
  accent: "#16A34A",
  surface: "#F8FAFC"
};

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function assertValidSlug(slug: string): void {
  if (slug.length < 2 || slug.length > 40 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    throw new Error("Slug must be 2-40 chars, lowercase letters/numbers/hyphens, and not start or end with a hyphen.");
  }

  const reserved = new Set(["admin", "api", "app", "docs", "help", "o1", "support", "www"]);
  if (reserved.has(slug)) {
    throw new Error(`Slug "${slug}" is reserved.`);
  }
}

export function assertHexAddress(value: string, field = "address"): asserts value is HexAddress {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${field} must be a 20-byte hex address.`);
  }
}

export function assertTokenSymbol(symbol: string): void {
  if (!/^[A-Z0-9]{2,12}$/.test(symbol)) {
    throw new Error("Symbol must be 2-12 uppercase letters or numbers.");
  }
}

export function clampFeeBps(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 50;
  if (!Number.isInteger(value) || value < 0 || value > 1_000) {
    throw new Error("additionalFeeBps must be an integer between 0 and 1000.");
  }
  return value;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string, entropy: string): string {
  const clean = entropy.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase();
  return `${prefix}_${clean}_${Date.now().toString(36)}`;
}
