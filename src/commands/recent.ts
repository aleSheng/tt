import { Command } from "commander";
import ora from "ora";
import { getRecentMaterials, ApiError } from "../lib/api.js";
import { isLoggedIn, saveLastSearchResults } from "../lib/config.js";
import { error, formatSearchResults, json } from "../lib/output.js";

export const recentCommand = new Command("recent")
  .description("List recent materials")
  .option("-l, --limit <number>", "Maximum number of results", "10")
  .option("--json", "Output result as JSON")
  .action(async (options: { limit: string; json?: boolean }) => {
    if (!isLoggedIn()) {
      error("Not logged in. Use: tt login --token <your-api-key>");
      process.exit(1);
    }

    const spinner = ora("Loading recent materials...").start();

    try {
      const limit = parseInt(options.limit, 10) || 10;
      const results = await getRecentMaterials(limit);

      spinner.stop();

      // 保存结果，便于使用 @N 快捷访问
      saveLastSearchResults(results.items.map(item => ({ id: item.id, title: item.title })));

      if (options.json) {
        json(results);
      } else {
        if (results.total === 0) {
          console.log("No materials yet. Use 'tt save' to add your first note!");
        } else {
          console.log(`📚 Recent materials:\n`);
          formatSearchResults(results, true);
        }
      }
    } catch (err) {
      spinner.stop();
      if (err instanceof ApiError) {
        error(`Failed to load recent materials: ${err.message}`);
      } else if (err instanceof Error) {
        error(`Failed to load recent materials: ${err.message}`);
      } else {
        error("Failed to load recent materials: Unknown error");
      }
      process.exit(1);
    }
  });
