import { homedir } from "node:os";
import { join } from "node:path";
import Conf from "conf";

// 配置文件路径: ~/.config/tagtime/config.json
const CONFIG_DIR = join(homedir(), ".config", "tagtime");

// Vault 配置
export interface VaultConfig {
  type: "obsidian" | "logseq" | "markdown";
  path: string;
  notesFolder?: string;
  dailyNotesFolder?: string;
  templatesFolder?: string;
  attachmentsFolder?: string;
  // Logseq specific
  pagesFolder?: string;
  journalsFolder?: string;
}

export type WorkMode = "local" | "cloud";

interface Config {
  // 工作模式
  mode: WorkMode;
  // Vault 配置
  defaultVault?: string;
  vaults: Record<string, VaultConfig>;
  // 云端配置
  apiKey?: string;
  baseUrl: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
  // 缓存最近的搜索结果，用于快速获取
  lastSearchResults?: Array<{
    id: string;
    title: string;
    path?: string; // 本地模式用
  }>;
}

const config = new Conf<Config>({
  projectName: "tagtime",
  cwd: CONFIG_DIR,
  defaults: {
    mode: "cloud",
    vaults: {},
    baseUrl: "https://tagtime.ai",
  },
});

export function getConfig(): Config {
  return {
    mode: config.get("mode"),
    defaultVault: config.get("defaultVault"),
    vaults: config.get("vaults"),
    apiKey: config.get("apiKey"),
    baseUrl: config.get("baseUrl"),
    user: config.get("user"),
  };
}

export function setApiKey(apiKey: string): void {
  config.set("apiKey", apiKey);
}

export function setUser(user: Config["user"]): void {
  config.set("user", user);
}

export function setBaseUrl(url: string): void {
  config.set("baseUrl", url);
}

export function clearConfig(): void {
  config.clear();
}

export function getApiKey(): string | undefined {
  return config.get("apiKey");
}

export function getBaseUrl(): string {
  return config.get("baseUrl");
}

export function isLoggedIn(): boolean {
  return !!config.get("apiKey");
}

// 保存最近搜索结果（用于 @N 快捷访问）
export function saveLastSearchResults(results: Array<{ id: string; title: string; path?: string }>): void {
  config.set("lastSearchResults", results);
}

// 获取最近搜索结果
export function getLastSearchResults(): Array<{ id: string; title: string; path?: string }> {
  return config.get("lastSearchResults") || [];
}

// 根据索引获取搜索结果的 ID（@1, @2, ...）
export function getIdByIndex(index: number): string | undefined {
  const results = getLastSearchResults();
  if (index >= 1 && index <= results.length) {
    return results[index - 1].id;
  }
  return undefined;
}

// 根据索引获取搜索结果的路径（本地模式）
export function getPathByIndex(index: number): string | undefined {
  const results = getLastSearchResults();
  if (index >= 1 && index <= results.length) {
    return results[index - 1].path;
  }
  return undefined;
}

// ==================== 工作模式 ====================

export function getMode(): WorkMode {
  return config.get("mode") || "cloud";
}

export function setMode(mode: WorkMode): void {
  config.set("mode", mode);
}

export function isLocalMode(): boolean {
  return getMode() === "local";
}

// ==================== Vault 管理 ====================

export function getVaults(): Record<string, VaultConfig> {
  return config.get("vaults") || {};
}

export function getVault(name: string): VaultConfig | undefined {
  const vaults = getVaults();
  return vaults[name];
}

export function addVault(name: string, vaultConfig: VaultConfig): void {
  const vaults = getVaults();
  vaults[name] = vaultConfig;
  config.set("vaults", vaults);
  
  // 如果是第一个 vault，自动设为默认
  if (Object.keys(vaults).length === 1) {
    config.set("defaultVault", name);
  }
}

export function removeVault(name: string): boolean {
  const vaults = getVaults();
  if (!vaults[name]) return false;
  
  delete vaults[name];
  config.set("vaults", vaults);
  
  // 如果删除的是默认 vault，重置默认
  if (getDefaultVaultName() === name) {
    const remaining = Object.keys(vaults);
    if (remaining[0]) {
      config.set("defaultVault", remaining[0]);
    } else {
      config.delete("defaultVault");
    }
  }
  
  return true;
}

export function getDefaultVaultName(): string | undefined {
  return config.get("defaultVault");
}

export function setDefaultVault(name: string): boolean {
  const vaults = getVaults();
  if (!vaults[name]) return false;
  
  config.set("defaultVault", name);
  return true;
}

export function getCurrentVault(): (VaultConfig & { name: string }) | undefined {
  const defaultName = getDefaultVaultName();
  if (!defaultName) return undefined;
  
  const vault = getVault(defaultName);
  if (!vault) return undefined;
  
  return { ...vault, name: defaultName };
}

export function hasVaults(): boolean {
  return Object.keys(getVaults()).length > 0;
}
