import { Command } from "commander";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import ora from "ora";
import chalk from "chalk";
import { searchMaterials, getMaterial, ApiError } from "../lib/api.js";
import { isLoggedIn } from "../lib/config.js";
import { success, error, info } from "../lib/output.js";

interface ExportOptions {
  output: string;
  format: "markdown" | "json";
  tag?: string;
  search?: string;
  limit: string;
  flat?: boolean;
  includeMetadata?: boolean;
  filenameTemplate: string;
  overwrite?: boolean;
  dryRun?: boolean;
  quiet?: boolean;
  json?: boolean;
}

interface ExportResult {
  id: string;
  title: string;
  path: string;
  status: "success" | "skipped" | "failed";
  reason?: string;
}

// Sanitize filename
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 100);
}

// Generate filename from template
function generateFilename(
  template: string,
  material: {
    id: string;
    title: string;
    type: string;
    createdAt?: string;
    tags?: Array<{ name: string }>;
  },
  format: "markdown" | "json"
): string {
  const date = material.createdAt
    ? new Date(material.createdAt).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];
  
  const tag = material.tags?.[0]?.name || "untagged";
  
  let filename = template
    .replace("{id}", material.id.slice(0, 8))
    .replace("{title}", sanitizeFilename(material.title))
    .replace("{date}", date)
    .replace("{type}", material.type)
    .replace("{tag}", sanitizeFilename(tag));
  
  const ext = format === "json" ? ".json" : ".md";
  if (!filename.endsWith(ext)) {
    filename += ext;
  }
  
  return filename;
}

// Format material as markdown
function formatAsMarkdown(
  material: {
    id: string;
    title: string;
    type: string;
    content?: string;
    sourceUrl?: string;
    createdAt?: string;
    tags?: Array<{ name: string }>;
  },
  includeMetadata: boolean
): string {
  const lines: string[] = [];
  
  if (includeMetadata) {
    lines.push("---");
    lines.push(`id: ${material.id}`);
    lines.push(`title: "${material.title.replace(/"/g, '\\"')}"`);
    lines.push(`type: ${material.type}`);
    if (material.tags && material.tags.length > 0) {
      lines.push(`tags: [${material.tags.map(t => t.name).join(", ")}]`);
    }
    if (material.createdAt) {
      lines.push(`created: ${material.createdAt}`);
    }
    if (material.sourceUrl) {
      lines.push(`source: ${material.sourceUrl}`);
    }
    lines.push("---");
    lines.push("");
  }
  
  // Add title as H1 if content doesn't start with one
  if (material.content && !material.content.trim().startsWith("# ")) {
    lines.push(`# ${material.title}`);
    lines.push("");
  }
  
  if (material.content) {
    lines.push(material.content);
  }
  
  return lines.join("\n");
}

export const exportCommand = new Command("export")
  .description("Export materials to local files")
  .requiredOption("-o, --output <dir>", "Output directory")
  .option("-f, --format <format>", "Output format: markdown, json", "markdown")
  .option("--tag <tag>", "Filter by tag")
  .option("--search <query>", "Filter by search query")
  .option("-l, --limit <n>", "Maximum number of items to export", "100")
  .option("--flat", "Don't create subdirectories")
  .option("--include-metadata", "Include metadata in exported files")
  .option("--filename-template <template>", "Filename template", "{date}-{title}")
  .option("--overwrite", "Overwrite existing files")
  .option("--dry-run", "Preview what would be exported")
  .option("-q, --quiet", "Minimal output")
  .option("--json", "Output results as JSON")
  .action(async (options: ExportOptions) => {
    if (!isLoggedIn()) {
      error("Not logged in. Use: tt login --token <your-api-key>");
      process.exit(1);
    }

    const format = options.format as "markdown" | "json";
    if (!["markdown", "json"].includes(format)) {
      error("Invalid format. Use: markdown or json");
      process.exit(1);
    }

    const spinner = options.quiet ? null : ora("Fetching materials...").start();
    
    try {
      const limit = Math.max(1, Math.min(1000, parseInt(options.limit, 10) || 100));
      
      // Search for materials to export
      const searchQuery = options.search || options.tag || "*";
      const searchResults = await searchMaterials(searchQuery, limit);
      
      if (searchResults.items.length === 0) {
        spinner?.stop();
        info("No materials found to export.");
        return;
      }
      
      spinner?.stop();
      
      if (!options.quiet && !options.json) {
        info(`Found ${searchResults.items.length} material(s) to export.`);
      }
      
      // Fetch full content for each material
      const results: ExportResult[] = [];
      const fetchSpinner = options.quiet ? null : ora(`Fetching content 0/${searchResults.items.length}...`).start();
      
      for (let i = 0; i < searchResults.items.length; i++) {
        const item = searchResults.items[i];
        if (fetchSpinner) {
          fetchSpinner.text = `Fetching content ${i + 1}/${searchResults.items.length}...`;
        }
        
        try {
          const material = await getMaterial(item.id);
          
          // Filter by tag if specified
          if (options.tag && (!material.tags || !material.tags.some(t => t.name === options.tag))) {
            results.push({
              id: item.id,
              title: item.title,
              path: "",
              status: "skipped",
              reason: `Tag "${options.tag}" not found`,
            });
            continue;
          }
          
          // Generate filename
          const filename = generateFilename(options.filenameTemplate, material, format);
          const outputPath = join(options.output, filename);
          
          if (options.dryRun) {
            results.push({
              id: item.id,
              title: item.title,
              path: outputPath,
              status: "success",
            });
            continue;
          }
          
          // Create output directory
          await mkdir(dirname(outputPath), { recursive: true });
          
          // Format content
          let content: string;
          if (format === "json") {
            content = JSON.stringify(material, null, 2);
          } else {
            content = formatAsMarkdown(material, !!options.includeMetadata);
          }
          
          // Write file
          await writeFile(outputPath, content, "utf-8");
          
          results.push({
            id: item.id,
            title: item.title,
            path: outputPath,
            status: "success",
          });
        } catch (err) {
          results.push({
            id: item.id,
            title: item.title,
            path: "",
            status: "failed",
            reason: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
      
      fetchSpinner?.stop();
      
      // Calculate stats
      const stats = {
        total: results.length,
        success: results.filter(r => r.status === "success").length,
        skipped: results.filter(r => r.status === "skipped").length,
        failed: results.filter(r => r.status === "failed").length,
      };
      
      // Output results
      if (options.json) {
        console.log(JSON.stringify({ results, stats }, null, 2));
      } else if (!options.quiet) {
        console.log("");
        
        if (options.dryRun) {
          console.log(chalk.bold("Would export:"));
        }
        
        for (const result of results) {
          const icon = result.status === "success" ? chalk.green("✓")
            : result.status === "skipped" ? chalk.yellow("⊘")
            : chalk.red("✗");
          const path = result.path.replace(process.cwd() + "/", "");
          const suffix = result.reason ? chalk.dim(` (${result.reason})`) : "";
          console.log(`  ${icon} ${result.title}${path ? ` → ${path}` : ""}${suffix}`);
        }
        
        console.log("");
        if (options.dryRun) {
          console.log(chalk.dim(`Would export ${stats.success} file(s) to ${options.output}`));
        } else {
          console.log(chalk.bold("Results:"));
          console.log(`  Exported: ${chalk.green(stats.success)}`);
          if (stats.skipped > 0) {
            console.log(`  Skipped:  ${chalk.yellow(stats.skipped)}`);
          }
          if (stats.failed > 0) {
            console.log(`  Failed:   ${chalk.red(stats.failed)}`);
          }
          console.log("");
          console.log(`  Output: ${options.output}`);
        }
      } else {
        console.log(`Exported: ${stats.success}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`);
      }
      
      if (stats.failed > 0) {
        process.exit(1);
      }
    } catch (err) {
      spinner?.stop();
      if (err instanceof ApiError) {
        error(`Export failed: ${err.message}`);
      } else if (err instanceof Error) {
        error(`Export failed: ${err.message}`);
      } else {
        error("Export failed: Unknown error");
      }
      process.exit(1);
    }
  });
