/**
 * 搜索索引管理器
 * 负责构建、缓存、更新 MiniSearch 索引
 */

import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, relative, basename } from "node:path";
import { homedir } from "node:os";
import { glob } from "glob";
import MiniSearch from "minisearch";
import type { VaultConfig } from "../config.js";
import { expandPath } from "./vault.js";
import { tokenize, processTerm } from "./tokenizer.js";

// 索引版本，变更时自动重建
const INDEX_VERSION = 1;

export interface IndexedDocument {
  id: string;          // 文件相对路径
  title: string;
  content: string;
  tags: string[];
  folder: string;
  modified: number;    // mtime timestamp
}

interface IndexCache {
  version: number;
  vaultPath: string;
  lastBuilt: string;
  fileCount: number;
  fileMtimes: Record<string, number>;  // path -> mtime
}

interface IndexState {
  index: MiniSearch<IndexedDocument>;
  cache: IndexCache;
  documents: Map<string, IndexedDocument>;
}

// 内存中的索引缓存
const indexCache = new Map<string, IndexState>();

/**
 * 获取缓存目录
 */
function getCacheDir(): string {
  return join(homedir(), ".config", "tagtime", "cache", "search");
}

/**
 * 获取 vault 的缓存文件路径
 */
function getCachePath(vaultName: string): string {
  return join(getCacheDir(), `${vaultName}.json`);
}

/**
 * 创建 MiniSearch 实例
 */
function createMiniSearch(): MiniSearch<IndexedDocument> {
  return new MiniSearch<IndexedDocument>({
    fields: ["title", "content", "tags", "folder"],
    storeFields: ["title", "folder", "modified", "tags"],
    
    // 自定义分词
    tokenize: (text) => tokenize(text),
    processTerm: (term) => processTerm(term) ?? undefined,
    
    // 搜索默认选项 (包括字段权重)
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 3, tags: 2, folder: 1.5, content: 1 },
    },
  });
}

/**
 * 解析 Markdown 文件的 frontmatter
 */
function parseFrontmatter(content: string): { title?: string; tags?: string[]; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { body: content };
  }
  
  const frontmatter = match[1];
  const body = content.slice(match[0].length);
  
  // 解析 title
  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const title = titleMatch ? titleMatch[1].trim() : undefined;
  
  // 解析 tags
  let tags: string[] = [];
  const tagsMatch = frontmatter.match(/^tags:\s*(.+)$/m);
  if (tagsMatch) {
    const tagsStr = tagsMatch[1].trim();
    // 支持 YAML 数组格式和逗号分隔
    if (tagsStr.startsWith("[")) {
      try {
        tags = JSON.parse(tagsStr.replace(/'/g, '"'));
      } catch {
        tags = tagsStr.slice(1, -1).split(",").map(t => t.trim().replace(/['"]/g, ""));
      }
    } else {
      tags = tagsStr.split(",").map(t => t.trim().replace(/['"]/g, ""));
    }
  }
  
  // 也支持多行 tags 格式
  const multiTagsMatch = frontmatter.match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
  if (multiTagsMatch) {
    tags = multiTagsMatch[1]
      .split("\n")
      .map(line => line.replace(/^\s*-\s*/, "").trim())
      .filter(t => t.length > 0);
  }
  
  return { title, tags, body };
}

/**
 * 从内容提取标题 (第一个 # 标题)
 */
function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * 构建单个文档的索引数据
 */
async function buildDocument(filePath: string, vaultPath: string): Promise<IndexedDocument | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const stats = await stat(filePath);
    const relativePath = relative(vaultPath, filePath).replace(/\\/g, "/");
    
    const { title: fmTitle, tags, body } = parseFrontmatter(content);
    const title = fmTitle || extractTitle(body) || basename(filePath, ".md");
    const folder = dirname(relativePath);
    
    return {
      id: relativePath,
      title,
      content: body.slice(0, 10000), // 限制内容长度
      tags: tags || [],
      folder: folder === "." ? "" : folder,
      modified: stats.mtimeMs,
    };
  } catch {
    return null;
  }
}

/**
 * 获取 vault 的所有 markdown 文件
 */
async function getVaultFiles(vaultPath: string, vaultConfig: VaultConfig): Promise<string[]> {
  let pattern: string;
  
  if (vaultConfig.type === "logseq" && vaultConfig.pagesFolder) {
    pattern = `{${vaultConfig.pagesFolder},${vaultConfig.journalsFolder || "journals"}}/**/*.md`;
  } else {
    pattern = "**/*.md";
  }
  
  const files = await glob(pattern, {
    cwd: vaultPath,
    nodir: true,
    absolute: true,
    ignore: [
      "**/node_modules/**",
      "**/.obsidian/**",
      "**/logseq/**",
      "**/.git/**",
      "**/.trash/**",
    ],
  });
  
  return files;
}

/**
 * 构建完整索引
 */
async function buildFullIndex(
  vaultName: string,
  vaultConfig: VaultConfig,
  onProgress?: (current: number, total: number) => void
): Promise<IndexState> {
  const vaultPath = expandPath(vaultConfig.path);
  const files = await getVaultFiles(vaultPath, vaultConfig);
  
  const index = createMiniSearch();
  const documents = new Map<string, IndexedDocument>();
  const fileMtimes: Record<string, number> = {};
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const doc = await buildDocument(file, vaultPath);
    
    if (doc) {
      index.add(doc);
      documents.set(doc.id, doc);
      fileMtimes[doc.id] = doc.modified;
    }
    
    onProgress?.(i + 1, files.length);
  }
  
  const cache: IndexCache = {
    version: INDEX_VERSION,
    vaultPath,
    lastBuilt: new Date().toISOString(),
    fileCount: documents.size,
    fileMtimes,
  };
  
  const state: IndexState = { index, cache, documents };
  indexCache.set(vaultName, state);
  
  return state;
}

/**
 * 检查并增量更新索引
 */
async function updateIndex(
  vaultName: string,
  vaultConfig: VaultConfig,
  state: IndexState
): Promise<IndexState> {
  const vaultPath = expandPath(vaultConfig.path);
  const files = await getVaultFiles(vaultPath, vaultConfig);
  
  const currentFiles = new Set(files.map(f => relative(vaultPath, f).replace(/\\/g, "/")));
  const indexedFiles = new Set(state.cache.fileMtimes ? Object.keys(state.cache.fileMtimes) : []);
  
  let updated = 0;
  let added = 0;
  let removed = 0;
  
  // 检查删除的文件
  for (const id of indexedFiles) {
    if (!currentFiles.has(id)) {
      state.index.discard(id);
      state.documents.delete(id);
      delete state.cache.fileMtimes[id];
      removed++;
    }
  }
  
  // 检查新增和修改的文件
  for (const file of files) {
    const id = relative(vaultPath, file).replace(/\\/g, "/");
    const stats = await stat(file);
    const oldMtime = state.cache.fileMtimes[id];
    
    if (!oldMtime) {
      // 新文件
      const doc = await buildDocument(file, vaultPath);
      if (doc) {
        state.index.add(doc);
        state.documents.set(doc.id, doc);
        state.cache.fileMtimes[doc.id] = doc.modified;
        added++;
      }
    } else if (stats.mtimeMs > oldMtime) {
      // 修改的文件
      const doc = await buildDocument(file, vaultPath);
      if (doc) {
        state.index.discard(id);
        state.index.add(doc);
        state.documents.set(doc.id, doc);
        state.cache.fileMtimes[doc.id] = doc.modified;
        updated++;
      }
    }
  }
  
  if (added > 0 || updated > 0 || removed > 0) {
    state.cache.lastBuilt = new Date().toISOString();
    state.cache.fileCount = state.documents.size;
  }
  
  return state;
}

/**
 * 保存索引缓存到磁盘
 */
async function saveIndexCache(vaultName: string, state: IndexState): Promise<void> {
  const cachePath = getCachePath(vaultName);
  const cacheDir = dirname(cachePath);
  
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }
  
  const data = {
    ...state.cache,
    indexData: state.index.toJSON(),
  };
  
  await writeFile(cachePath, JSON.stringify(data), "utf-8");
}

/**
 * 从磁盘加载索引缓存
 */
async function loadIndexCache(vaultName: string, vaultConfig: VaultConfig): Promise<IndexState | null> {
  const cachePath = getCachePath(vaultName);
  
  if (!existsSync(cachePath)) {
    return null;
  }
  
  try {
    const content = await readFile(cachePath, "utf-8");
    const data = JSON.parse(content);
    
    // 检查版本和路径
    if (data.version !== INDEX_VERSION) {
      return null;
    }
    
    if (data.vaultPath !== expandPath(vaultConfig.path)) {
      return null;
    }
    
    // 恢复索引 (使用静态方法)
    const index = MiniSearch.loadJS<IndexedDocument>(data.indexData, {
      fields: ["title", "content", "tags", "folder"],
      storeFields: ["title", "folder", "modified", "tags"],
      tokenize: (text) => tokenize(text),
      processTerm: (term) => processTerm(term) ?? undefined,
    });
    
    // 重建 documents map (从 storeFields)
    const documents = new Map<string, IndexedDocument>();
    
    const cache: IndexCache = {
      version: data.version,
      vaultPath: data.vaultPath,
      lastBuilt: data.lastBuilt,
      fileCount: data.fileCount,
      fileMtimes: data.fileMtimes || {},
    };
    
    return { index, cache, documents };
  } catch {
    return null;
  }
}

/**
 * 获取 vault 的搜索索引 (自动处理缓存和更新)
 */
export async function getSearchIndex(
  vaultName: string,
  vaultConfig: VaultConfig,
  options: {
    forceRebuild?: boolean;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<MiniSearch<IndexedDocument>> {
  // 检查内存缓存
  if (!options.forceRebuild && indexCache.has(vaultName)) {
    const state = indexCache.get(vaultName)!;
    const updated = await updateIndex(vaultName, vaultConfig, state);
    return updated.index;
  }
  
  // 尝试从磁盘加载
  if (!options.forceRebuild) {
    const loaded = await loadIndexCache(vaultName, vaultConfig);
    if (loaded) {
      indexCache.set(vaultName, loaded);
      const updated = await updateIndex(vaultName, vaultConfig, loaded);
      await saveIndexCache(vaultName, updated);
      return updated.index;
    }
  }
  
  // 全量构建
  const state = await buildFullIndex(vaultName, vaultConfig, options.onProgress);
  await saveIndexCache(vaultName, state);
  
  return state.index;
}

/**
 * 获取索引统计信息
 */
export function getIndexStats(vaultName: string): {
  fileCount: number;
  lastBuilt: string;
  cached: boolean;
} | null {
  const state = indexCache.get(vaultName);
  if (!state) return null;
  
  return {
    fileCount: state.cache.fileCount,
    lastBuilt: state.cache.lastBuilt,
    cached: true,
  };
}

/**
 * 清除索引缓存
 */
export function clearIndexCache(vaultName?: string): void {
  if (vaultName) {
    indexCache.delete(vaultName);
  } else {
    indexCache.clear();
  }
}
