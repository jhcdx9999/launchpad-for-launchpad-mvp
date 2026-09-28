import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertHexAddress, type HexAddress } from "../../../packages/shared/src/domain.ts";
import { loadEnv } from "./env.ts";

interface FileConfig {
  name: string;
  defaultHost: string;
  defaultPort: number;
  defaultPublicBaseDomain: string;
  defaultDataFile: string;
  defaultStatsFile: string;
  defaultAdminUsername: string;
  defaultAdminPassword: string;
  defaultAdminSessionSecret: string;
  defaultDemoOwnerWallet: HexAddress;
  defaultDemoCreatorWallet: HexAddress;
}

export interface AppConfig {
  name: string;
  host: string;
  port: number;
  publicAppUrl: string;
  publicBaseDomain: string;
  dataFile: string;
  statsFile: string;
  adminUsername: string;
  adminPassword: string;
  adminSessionSecret: string;
  demoOwnerWallet: HexAddress;
  demoCreatorWallet: HexAddress;
}

function readFileConfig(): FileConfig {
  return JSON.parse(readFileSync(resolve("config/app.config.json"), "utf8")) as FileConfig;
}

export function getConfig(): AppConfig {
  loadEnv();
  const file = readFileConfig();
  const host = process.env.HOST || file.defaultHost;
  const port = Number(process.env.PORT || file.defaultPort);
  const publicBaseDomain = process.env.PUBLIC_BASE_DOMAIN || file.defaultPublicBaseDomain;
  const publicAppUrl = process.env.PUBLIC_APP_URL || `http://${host}:${port}`;
  const dataFile = process.env.DATA_FILE || file.defaultDataFile;
  const statsFile = process.env.STATS_FILE || file.defaultStatsFile;
  const adminUsername = process.env.ADMIN_USERNAME || file.defaultAdminUsername;
  const adminPassword = process.env.ADMIN_PASSWORD || file.defaultAdminPassword;
  const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || file.defaultAdminSessionSecret;
  const demoOwnerWallet = process.env.DEMO_OWNER_WALLET || file.defaultDemoOwnerWallet;
  const demoCreatorWallet = process.env.DEMO_CREATOR_WALLET || file.defaultDemoCreatorWallet;

  if (!adminUsername) throw new Error("ADMIN_USERNAME is required.");
  if (!adminPassword) throw new Error("ADMIN_PASSWORD is required.");
  if (!adminSessionSecret) throw new Error("ADMIN_SESSION_SECRET is required.");
  assertHexAddress(demoOwnerWallet, "DEMO_OWNER_WALLET");
  assertHexAddress(demoCreatorWallet, "DEMO_CREATOR_WALLET");

  return {
    name: file.name,
    host,
    port,
    publicAppUrl,
    publicBaseDomain,
    dataFile,
    statsFile,
    adminUsername,
    adminPassword,
    adminSessionSecret,
    demoOwnerWallet,
    demoCreatorWallet
  };
}

export function publicConfigScript(config: AppConfig): string {
  const publicConfig = {
    appName: config.name,
    appUrl: config.publicAppUrl,
    baseDomain: config.publicBaseDomain,
    demoWallet: config.demoOwnerWallet
  };

  return `window.__O1_LAUNCHPAD_CONFIG__ = ${JSON.stringify(publicConfig, null, 2)};\n`;
}
