import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { searchMaterials, ApiError } from "../lib/api.js";
import { isLoggedIn, saveLastSearchResults, isLocalMode, getCurrentVault, getVault, getDefaultVaultName } from "../lib/config.js";
import { error, formatSearchResults, json } from "../lib/output.js";
import { searchLocal, type SearchResult } from "../lib/local/search.js";

interface SearchOptions {
  limit: string;
  json?: boolean;
  vault?: string;
  folder?: string;
  tag?: string;
  fuzzy?: boolean | string;
  exact?: boolean;
  rebuildIndex?: boolean;
}

export const searchCommand = new Command("search")
  .description("Search your materials")
  .argument("<query>", "Search query")
  .option("-l, --limit <number>", "Maximum number of results", "10")
  .option("--json", "Output result as JSON")
  .option("--vault <name>", "Specify vault (local mode)")
  .option("--folder <path>", "Limit search to folder (local mode)")
  .option("-t, --tag <tag>", "Filter by tag (local mode)")
  .option("--fuzzy [distance]", "Enable fuzzy search (default: 0.2)")
  .option("--no-fuzzy", "Disable fuzzy search")
  .option("--exact", "Exact match (disable fuzzy and prefix)")
  .option("--rebuild-index", "Force rebuild search index")
  .action(async (query: string, options: SearchOptions) => {
    const limit = parseInt(options.limit, 10) || 10;

    // 本地模式
    if (isLocalMode()) {
      // 获取 vault
      const vault = options.vault ? getVault(options.vault) : getCurrentVault();
      const vaultName = options.vault || getDefaultVaultName();
      
      if (!vault) {
        error("No vault configured. Add one with: tt vault add <name> <path>");
        process.exit(1);
      }

      const spinner = ora("Searching...").start();
      const startTime = Date.now();

      try {
        // 解析 fuzzy 选项
        let fuzzy: number | boolean | undefined;
        if (options.exact) {
          fuzzy = false;
        } else if (options.fuzzy === true || options.fuzzy === "") {
          fuzzy = 0.2;
        } else if (typeof options.fuzzy === "string") {
          fuzzy = parseFloat(options.fuzzy);
        } else if (options.fuzzy === false) {
          fuzzy = false;
        }

        const results = await searchLocal(query, vault, {
          limit,
          folder: options.folder,
          tag: options.tag,
          fuzzy,
          exact: options.exact,
          forceRebuild: options.rebuildIndex,
        }, vaultName);

        const elapsed = Date.now() - startTime;
        spinner.stop();

        // 保存搜索结果
        saveLastSearchResults(results.map((item, index) => ({
          id: String(index + 1),
          title: item.title,
          path: item.path,
        })));

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            data: {
              total: results.length,
              elapsed: `${elapsed}ms`,
              items: results,
            },
          }, null, 2));
        } else {
          formatLocalSearchResults(results, vaultName, elapsed);
        }
      } catch (err) {
        spinner.stop();
        error(`Search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        process.exit(1);
      }
      return;
    }

    // 云端模式
    if (!isLoggedIn()) {
      error("Not logged in. Use: tt login --token <your-api-key>");
      process.exit(1);
    }

    const spinner = ora("Searching...").start();

    try {
      const results = await searchMaterials(query, limit);

      spinner.stop();

      // 保存搜索结果，便于使用 @N 快捷访问
      saveLastSearchResults(results.items.map(item => ({ id: item.id, title: item.title })));

      if (options.json) {
        json(results);
      } else {
        formatSearchResults(results, true); // 显示序号
      }
    } catch (err) {
      spinner.stop();
      if (err instanceof ApiError) {
        error(`Search failed: ${err.message}`);
      } else if (err instanceof Error) {
        error(`Search failed: ${err.message}`);
      } else {
        error("Search failed: Unknown error");
      }
      process.exit(1);
    }
  });

/**
 * 格式化本地搜索结果输出
 */
function formatLocalSearchResults(
  results: SearchResult[],
  vaultName?: string,
  elapsed?: number
) {
  if (results.length === 0) {
    console.log(chalk.yellow("No results found."));
    return;
  }

  console.log();
  const timeStr = elapsed ? ` ${chalk.gray(`(${elapsed}ms)`)}` : "";
  console.log(`Found ${chalk.green(results.length)} result(s)${vaultName ? ` in ${chalk.cyan(vaultName)}` : ""}${timeStr}:`);
  console.log();

  results.forEach((item, index) => {
    const num = chalk.cyan(`@${index + 1}`);
    const title = chalk.bold(item.title);
    
    // 显示相关度分数
    let scoreStr = "";
    if (item.score !== undefined) {
      const stars = item.score >= 2 ? "★★★" : item.score >= 1 ? "★★☆" : "★☆☆";
      scoreStr = ` ${chalk.yellow(stars)} ${chalk.gray(item.score.toFixed(2))}`;
    }
    
    console.log(`${num} ${title}${scoreStr}`);
    console.log(chalk.gray(`   Path: ${item.path}`));
    
    // 显示标签
    if (item.tags && item.tags.length > 0) {
      console.log(chalk.gray(`   Tags: ${item.tags.map(t => chalk.blue(t)).join(", ")}`));
    }
    
    if (item.modified) {
      console.log(chalk.gray(`   Modified: ${item.modified.toLocaleDateString()}`));
    }
    console.log(chalk.gray(`   ${item.snippet}`));
    console.log();
  });
}
