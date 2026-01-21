import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import ora from "ora";
import chalk from "chalk";
import { getMaterial, ApiError } from "../lib/api.js";
import { isLoggedIn, getBaseUrl, getIdByIndex, isLocalMode, getCurrentVault, getVault, getPathByIndex } from "../lib/config.js";
import { error, formatMaterial, json } from "../lib/output.js";
import { readNote, formatNoteOutput } from "../lib/local/notes.js";

interface GetOptions {
  json?: boolean;
  output?: string;
  raw?: boolean;
  noFrontmatter?: boolean;
  vault?: string;
}

/**
 * 解析 ID 参数，支持：
 * - @1, @2, ... - 从上次搜索结果中获取
 * - abc123 - 短 ID 前缀（服务端支持）
 * - 完整 UUID
 */
function resolveId(idArg: string): string | null {
  // @N 格式：从上次搜索结果获取
  if (idArg.startsWith("@")) {
    const index = parseInt(idArg.slice(1), 10);
    if (isNaN(index) || index < 1) {
      return null;
    }
    const resolvedId = getIdByIndex(index);
    if (!resolvedId) {
      return null;
    }
    return resolvedId;
  }
  
  // 否则直接使用（可能是短 ID 或完整 ID）
  return idArg;
}

/**
 * 解析本地模式的路径参数
 */
function resolveLocalPath(pathArg: string): string | null {
  // @N 格式
  if (pathArg.startsWith("@")) {
    const index = parseInt(pathArg.slice(1), 10);
    if (isNaN(index) || index < 1) {
      return null;
    }
    return getPathByIndex(index) || null;
  }
  
  // 直接路径
  let path = pathArg;
  if (!path.endsWith(".md") && !path.endsWith(".markdown")) {
    path += ".md";
  }
  return path;
}

export const getCommand = new Command("get")
  .description("Get a material by ID or path")
  .argument("<id>", "Material ID, @N (search result), path (local mode)")
  .option("--json", "Output result as JSON")
  .option("-o, --output <file>", "Save to file")
  .option("--raw", "Output raw content only")
  .option("--no-frontmatter", "Exclude frontmatter (local mode)")
  .option("--vault <name>", "Specify vault (local mode)")
  .action(async (idArg: string, options: GetOptions) => {
    // 本地模式
    if (isLocalMode()) {
      const vault = options.vault ? getVault(options.vault) : getCurrentVault();
      
      if (!vault) {
        error("No vault configured. Add one with: tt vault add <name> <path>");
        process.exit(1);
      }

      const path = resolveLocalPath(idArg);
      if (!path) {
        if (idArg.startsWith("@")) {
          error(`Invalid index: ${idArg}. Run 'tt search' first, then use @1, @2, etc.`);
        } else {
          error(`Invalid path: ${idArg}`);
        }
        process.exit(1);
      }

      const spinner = ora("Reading note...").start();

      try {
        const note = await readNote(path, vault);
        spinner.stop();

        // 输出到文件
        if (options.output) {
          const content = formatNoteOutput(note, { 
            raw: options.raw, 
            noFrontmatter: options.noFrontmatter 
          });
          await writeFile(options.output, content, "utf-8");
          console.log(chalk.green("✓") + ` Saved to ${options.output}`);
          return;
        }

        // JSON 输出
        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            data: note,
          }, null, 2));
          return;
        }

        // 普通输出
        console.log();
        console.log(chalk.bold(note.title));
        console.log(chalk.gray(`Path: ${note.path}`));
        if (note.modified) {
          console.log(chalk.gray(`Modified: ${note.modified.toLocaleString()}`));
        }
        console.log(chalk.gray("-".repeat(50)));
        console.log();
        console.log(formatNoteOutput(note, { 
          raw: options.raw, 
          noFrontmatter: options.noFrontmatter 
        }));
      } catch (err) {
        spinner.stop();
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          error(`Note not found: ${path}`);
        } else {
          error(`Failed to read note: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
        process.exit(1);
      }
      return;
    }

    // 云端模式
    if (!isLoggedIn()) {
      error("Not logged in. Use: tt login --token <your-api-key>");
      process.exit(1);
    }

    // 解析 ID
    const id = resolveId(idArg);
    if (!id) {
      if (idArg.startsWith("@")) {
        error(`Invalid index: ${idArg}. Run 'tt search' first, then use @1, @2, etc.`);
      } else {
        error(`Invalid ID: ${idArg}`);
      }
      process.exit(1);
    }

    const spinner = ora("Fetching...").start();

    try {
      const material = await getMaterial(id);

      spinner.stop();

      // 输出到文件
      if (options.output) {
        const content = material.content || "";
        await writeFile(options.output, content, "utf-8");
        console.log(chalk.green("✓") + ` Saved to ${options.output}`);
        return;
      }

      if (options.json) {
        json(material);
      } else {
        const baseUrl = getBaseUrl();
        console.log(formatMaterial({
          ...material,
          url: `${baseUrl}/library/${material.id}`,
        }));
      }
    } catch (err) {
      spinner.stop();
      if (err instanceof ApiError) {
        if (err.code === "NOT_FOUND") {
          error(`Material not found: ${idArg}`);
        } else if (err.code === "AMBIGUOUS_ID") {
          error(`Multiple materials match '${idArg}'. Please use a longer ID prefix.`);
        } else {
          error(`Failed to get material: ${err.message}`);
        }
      } else if (err instanceof Error) {
        error(`Failed to get material: ${err.message}`);
      } else {
        error("Failed to get material: Unknown error");
      }
      process.exit(1);
    }
  });
