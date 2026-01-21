import { existsSync, statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";
import type { VaultConfig } from "../config.js";

export interface VaultInfo {
  name: string;
  type: VaultConfig["type"];
  path: string;
  noteCount?: number;
  sizeBytes?: number;
  lastModified?: Date;
}

/**
 * 展开路径中的 ~ 为用户目录
 */
export function expandPath(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return resolve(path);
}

/**
 * 检测目录是否是 Obsidian vault
 */
export function isObsidianVault(path: string): boolean {
  const expanded = expandPath(path);
  return existsSync(join(expanded, ".obsidian"));
}

/**
 * 检测目录是否是 Logseq graph
 */
export function isLogseqGraph(path: string): boolean {
  const expanded = expandPath(path);
  return (
    existsSync(join(expanded, "logseq")) ||
    (existsSync(join(expanded, "pages")) && existsSync(join(expanded, "journals")))
  );
}

/**
 * 自动检测目录类型
 */
export function detectVaultType(path: string): VaultConfig["type"] {
  if (isObsidianVault(path)) return "obsidian";
  if (isLogseqGraph(path)) return "logseq";
  return "markdown";
}

/**
 * 验证路径是否存在且是目录
 */
export function validateVaultPath(path: string): { valid: boolean; error?: string } {
  const expanded = expandPath(path);
  
  if (!existsSync(expanded)) {
    return { valid: false, error: `Path does not exist: ${expanded}` };
  }
  
  const stats = statSync(expanded);
  if (!stats.isDirectory()) {
    return { valid: false, error: `Path is not a directory: ${expanded}` };
  }
  
  return { valid: true };
}

/**
 * 统计 vault 中的笔记数量
 */
export async function countNotes(vaultPath: string, type: VaultConfig["type"]): Promise<number> {
  const expanded = expandPath(vaultPath);
  let count = 0;
  
  async function scanDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // 跳过隐藏目录和特殊目录
      if (entry.name.startsWith(".") || 
          entry.name === "node_modules" ||
          entry.name === ".obsidian" ||
          entry.name === "logseq" ||
          entry.name === ".trash") {
        continue;
      }
      
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile()) {
        const ext = entry.name.toLowerCase();
        if (ext.endsWith(".md") || ext.endsWith(".markdown")) {
          count++;
        }
      }
    }
  }
  
  await scanDir(expanded);
  return count;
}

/**
 * 获取 vault 的详细信息
 */
export async function getVaultInfo(
  name: string,
  config: VaultConfig
): Promise<VaultInfo> {
  const expanded = expandPath(config.path);
  
  const info: VaultInfo = {
    name,
    type: config.type,
    path: config.path,
  };
  
  try {
    info.noteCount = await countNotes(config.path, config.type);
    
    const stats = await stat(expanded);
    info.lastModified = stats.mtime;
  } catch {
    // 忽略错误
  }
  
  return info;
}

/**
 * 获取默认的 vault 配置
 */
export function getDefaultVaultConfig(path: string, type: VaultConfig["type"]): VaultConfig {
  const baseConfig: VaultConfig = {
    type,
    path,
  };
  
  if (type === "obsidian") {
    return {
      ...baseConfig,
      notesFolder: "",
      dailyNotesFolder: "Daily",
      templatesFolder: "Templates",
      attachmentsFolder: "Attachments",
    };
  }
  
  if (type === "logseq") {
    return {
      ...baseConfig,
      pagesFolder: "pages",
      journalsFolder: "journals",
    };
  }
  
  return baseConfig;
}
