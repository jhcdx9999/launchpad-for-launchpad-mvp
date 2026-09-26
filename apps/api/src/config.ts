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
  const demoOwnerWallet = process.env.DEMO_OWNER_WALLET || file.defaultDemoOwnerWallet;
  const demoCreatorWallet = process.env.DEMO_CREATOR_WALLET || file.defaultDemoCreatorWallet;

  assertHexAddress(demoOwnerWallet, "DEMO_OWNER_WALLET");
  assertHexAddress(demoCreatorWallet, "DEMO_CREATOR_WALLET");

  return {
    name: file.name,
    host,
    port,
    publicAppUrl,
    publicBaseDomain,
    dataFile,
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
