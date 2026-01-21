import { readFile, writeFile, mkdir, stat, access } from "node:fs/promises";
import { join, dirname, basename, extname } from "node:path";
import { constants } from "node:fs";
import matter from "gray-matter";
import type { VaultConfig } from "../config.js";
import { expandPath } from "./vault.js";

export interface LocalNote {
  path: string;           // 相对于 vault 的路径
  absolutePath: string;   // 绝对路径
  title: string;
  content: string;
  frontmatter?: Record<string, any>;
  created?: Date;
  modified?: Date;
}

export interface SaveNoteOptions {
  title?: string;
  folder?: string;
  tags?: string[];
  daily?: boolean;
}

/**
 * 清理文件名，移除非法字符
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/**
 * 从内容生成标题
 */
function generateTitleFromContent(content: string): string {
  // 尝试从第一行提取
  const firstLine = content.split("\n")[0]?.trim();
  if (firstLine) {
    // 移除 markdown 标题符号
    const cleaned = firstLine.replace(/^#+\s*/, "").slice(0, 50);
    if (cleaned) return cleaned;
  }
  
  // 使用时间戳
  return `Note-${Date.now()}`;
}

/**
 * 获取今日日期字符串
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 读取本地笔记
 */
export async function readNote(
  notePath: string,
  vaultConfig: VaultConfig
): Promise<LocalNote> {
  const vaultPath = expandPath(vaultConfig.path);
  const absolutePath = join(vaultPath, notePath);
  
  const content = await readFile(absolutePath, "utf-8");
  const stats = await stat(absolutePath);
  
  // 解析 frontmatter
  const { data: frontmatter, content: body } = matter(content);
  
  // 获取标题
  const title = 
    frontmatter.title as string ||
    body.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    basename(notePath, extname(notePath));
  
  return {
    path: notePath,
    absolutePath,
    title,
    content: body,
    frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined,
    created: frontmatter.created ? new Date(frontmatter.created) : stats.birthtime,
    modified: stats.mtime,
  };
}

/**
 * 通过路径模糊匹配获取笔记
 */
export async function findNoteByPath(
  pathOrName: string,
  vaultConfig: VaultConfig
): Promise<string | null> {
  const vaultPath = expandPath(vaultConfig.path);
  
  // 尝试直接路径
  let testPath = pathOrName;
  if (!testPath.endsWith(".md")) {
    testPath += ".md";
  }
  
  try {
    await access(join(vaultPath, testPath), constants.R_OK);
    return testPath;
  } catch {
    // 继续尝试其他方式
  }
  
  // TODO: 实现模糊搜索
  return null;
}

/**
 * 保存笔记到本地 vault
 */
export async function saveNote(
  content: string,
  vaultConfig: VaultConfig,
  options: SaveNoteOptions = {}
): Promise<{ path: string; absolutePath: string }> {
  const vaultPath = expandPath(vaultConfig.path);
  
  let folder = options.folder || vaultConfig.notesFolder || "";
  let filename: string;
  
  // 日记模式
  if (options.daily) {
    folder = vaultConfig.dailyNotesFolder || "Daily";
    filename = `${getTodayDateString()}.md`;
  } else {
    const title = options.title || generateTitleFromContent(content);
    filename = `${sanitizeFilename(title)}.md`;
  }
  
  const relativePath = folder ? join(folder, filename) : filename;
  const absolutePath = join(vaultPath, relativePath);
  
  // 确保目录存在
  await mkdir(dirname(absolutePath), { recursive: true });
  
  // 构建文件内容
  let fileContent: string;
  
  if (options.daily) {
    // 日记模式：检查文件是否存在，存在则追加
    try {
      const existing = await readFile(absolutePath, "utf-8");
      const timestamp = new Date().toLocaleTimeString();
      fileContent = `${existing}\n\n## ${timestamp}\n\n${content}`;
    } catch {
      // 文件不存在，创建新文件
      const frontmatter = {
        date: getTodayDateString(),
        tags: options.tags || [],
      };
      fileContent = matter.stringify(`# ${getTodayDateString()}\n\n${content}`, frontmatter);
    }
  } else {
    // 普通模式：创建带 frontmatter 的文件
    const title = options.title || generateTitleFromContent(content);
    const frontmatter: Record<string, any> = {
      title,
      created: new Date().toISOString(),
    };
    
    if (options.tags && options.tags.length > 0) {
      frontmatter.tags = options.tags;
    }
    
    // 如果内容不以标题开头，添加标题
    let body = content;
    if (!content.trim().startsWith("#")) {
      body = `# ${title}\n\n${content}`;
    }
    
    fileContent = matter.stringify(body, frontmatter);
  }
  
  await writeFile(absolutePath, fileContent, "utf-8");
  
  return { path: relativePath, absolutePath };
}

/**
 * 格式化笔记输出
 */
export function formatNoteOutput(note: LocalNote, options: {
  raw?: boolean;
  noFrontmatter?: boolean;
} = {}): string {
  if (options.raw) {
    return note.content;
  }
  
  if (options.noFrontmatter || !note.frontmatter) {
    return note.content;
  }
  
  // 重新生成带 frontmatter 的内容
  return matter.stringify(note.content, note.frontmatter);
}
