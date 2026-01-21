/**
 * 本地搜索模块 - 使用 MiniSearch 全文搜索引擎
 */

import { readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import type { SearchResult as MiniSearchResult } from "minisearch";
import type { VaultConfig } from "../config.js";
import { expandPath } from "./vault.js";
import { getSearchIndex } from "./index-manager.js";

export interface SearchResult {
  path: string;           // 相对于 vault 的路径
  absolutePath: string;
  title: string;
  snippet: string;
  modified?: Date;
  score?: number;         // 相关度分数
  matchedFields?: string[]; // 匹配的字段
  tags?: string[];        // 标签
}

export interface SearchOptions {
  limit?: number;
  folder?: string;
  tag?: string;           // 按标签过滤
  fuzzy?: number | boolean; // 模糊搜索 (0-1 或 true/false)
  prefix?: boolean;       // 前缀搜索
  exact?: boolean;        // 精确匹配
  forceRebuild?: boolean; // 强制重建索引
}

/**
 * 从内容中提取匹配查询的片段
 */
function extractSnippet(content: string, query: string, maxLength = 150): string {
  const lowerContent = content.toLowerCase();
  const queryTerms = query.toLowerCase().split(/\s+/);
  
  // 查找第一个匹配的位置
  let bestIndex = -1;
  for (const term of queryTerms) {
    const index = lowerContent.indexOf(term);
    if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
      bestIndex = index;
    }
  }
  
  if (bestIndex === -1) {
    // 返回内容开头
    const cleaned = content.replace(/^---[\s\S]*?---\n?/, ""); // 移除 frontmatter
    return cleaned.slice(0, maxLength).replace(/\n/g, " ").trim() + "...";
  }
  
  // 提取匹配位置附近的内容
  const start = Math.max(0, bestIndex - 50);
  const end = Math.min(content.length, bestIndex + 100);
  
  let snippet = content.slice(start, end).replace(/\n/g, " ").trim();
  
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  
  return snippet;
}

/**
 * 获取匹配的字段
 */
function getMatchedFields(match: Record<string, string[]>): string[] {
  return Object.keys(match);
}

/**
 * 在本地 vault 中搜索 (使用 MiniSearch)
 */
export async function searchLocal(
  query: string,
  vaultConfig: VaultConfig,
  options: SearchOptions = {},
  vaultName?: string
): Promise<SearchResult[]> {
  const vaultPath = expandPath(vaultConfig.path);
  const limit = options.limit || 10;
  const name = vaultName || "default";
  
  // 获取搜索索引
  const index = await getSearchIndex(name, vaultConfig, {
    forceRebuild: options.forceRebuild,
  });
  
  // 构建搜索选项
  const searchOptions: Parameters<typeof index.search>[1] = {};
  
  if (options.exact) {
    // 精确匹配: 禁用模糊和前缀
    searchOptions.fuzzy = false;
    searchOptions.prefix = false;
  } else {
    // 模糊搜索
    if (options.fuzzy === true) {
      searchOptions.fuzzy = 0.2;
    } else if (typeof options.fuzzy === "number") {
      searchOptions.fuzzy = options.fuzzy;
    } else if (options.fuzzy !== false) {
      searchOptions.fuzzy = 0.2; // 默认开启
    }
    
    // 前缀搜索
    searchOptions.prefix = options.prefix !== false; // 默认开启
  }
  
  // 文件夹过滤
  if (options.folder) {
    const folderPath = options.folder.replace(/\\/g, "/");
    searchOptions.filter = (result: MiniSearchResult) => {
      const folder = result.folder as string || "";
      return folder.startsWith(folderPath) || folder === folderPath;
    };
  }
  
  // 标签过滤
  if (options.tag) {
    const tagFilter = options.tag.toLowerCase();
    const originalFilter = searchOptions.filter;
    searchOptions.filter = (result: MiniSearchResult) => {
      const tags = (result.tags as string[] || []).map(t => t.toLowerCase());
      const matchesTag = tags.includes(tagFilter);
      return matchesTag && (!originalFilter || originalFilter(result));
    };
  }
  
  // 执行搜索
  const searchResults = index.search(query, searchOptions);
  
  // 转换结果
  const results: SearchResult[] = [];
  
  for (const result of searchResults.slice(0, limit)) {
    const filePath = result.id;
    const absolutePath = join(vaultPath, filePath);
    
    try {
      // 读取文件获取 snippet
      const content = await readFile(absolutePath, "utf-8");
      const snippet = extractSnippet(content, query);
      const stats = await stat(absolutePath);
      
      results.push({
        path: filePath,
        absolutePath,
        title: result.title as string || basename(filePath, ".md"),
        snippet,
        modified: stats.mtime,
        score: result.score,
        matchedFields: getMatchedFields(result.match),
        tags: result.tags as string[] || [],
      });
    } catch {
      // 文件可能已删除，跳过
      continue;
    }
  }
  
  return results;
}
