import { Command } from "commander";
import { readFile, stat, readdir } from "node:fs/promises";
import { basename, resolve, join, extname } from "node:path";
import { glob } from "glob";
import ora from "ora";
import chalk from "chalk";
import { createMaterial, ApiError } from "../lib/api.js";
import { isLoggedIn } from "../lib/config.js";
import { success, error, warn, info } from "../lib/output.js";

// Supported text file extensions
const TEXT_EXTENSIONS = new Set([
  ".md", ".markdown", ".txt", ".text",
  ".json", ".yaml", ".yml",
  ".js", ".ts", ".jsx", ".tsx",
  ".py", ".rb", ".go", ".rs", ".java", ".kt",
  ".css", ".scss", ".less",
  ".html", ".xml", ".svg",
  ".sh", ".bash", ".zsh",
  ".sql", ".graphql",
  ".env", ".ini", ".toml", ".conf",
]);

// Max file size for import (1MB)
const MAX_FILE_SIZE = 1024 * 1024;

interface ImportResult {
  path: string;
  status: "success" | "skipped" | "failed";
  id?: string;
  url?: string;
  reason?: string;
}

interface ImportStats {
  total: number;
  success: number;
  skipped: number;
  failed: number;
}

// Check if a file is a text file we can import
function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || ext === "";
}

// Generate title from filename
function generateTitleFromFilename(filename: string): string {
  // Remove extension
  let title = basename(filename, extname(filename));
  
  // Replace common separators with spaces
  title = title.replace(/[-_]/g, " ");
  
  // Remove date prefixes like "2024-01-20-"
  title = title.replace(/^\d{4}-\d{2}-\d{2}[-_\s]?/, "");
  
  // Capitalize first letter of each word
  title = title.replace(/\b\w/g, (c) => c.toUpperCase());
  
  return title.trim() || basename(filename);
}

// Extract title from markdown content (first H1)
function extractTitleFromContent(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// Collect files to import
async function collectFiles(
  patterns: string[],
  recursive: boolean,
  ignorePatterns: string[]
): Promise<string[]> {
  const files: string[] = [];
  
  for (const pattern of patterns) {
    const resolved = resolve(pattern);
    
    try {
      const stats = await stat(resolved);
      
      if (stats.isDirectory()) {
        // Directory: collect all text files
        const globPattern = recursive 
          ? join(resolved, "**/*")
          : join(resolved, "*");
        
        const matches = await glob(globPattern, {
          nodir: true,
          ignore: [
            "**/node_modules/**",
            "**/.git/**",
            "**/.*",
            ...ignorePatterns,
          ],
        });
        
        files.push(...matches.filter(isTextFile));
      } else if (stats.isFile()) {
        // Single file
        files.push(resolved);
      }
    } catch {
      // Try as glob pattern
      const matches = await glob(pattern, {
        nodir: true,
        ignore: ignorePatterns,
      });
      files.push(...matches.filter(isTextFile));
    }
  }
  
  // Remove duplicates
  return [...new Set(files)];
}

// Import a single file
async function importFile(
  filePath: string,
  tags?: string[]
): Promise<ImportResult> {
  const relativePath = filePath.replace(process.cwd() + "/", "");
  
  try {
    // Check file size
    const stats = await stat(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      return {
        path: relativePath,
        status: "skipped",
        reason: `File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB > 1MB)`,
      };
    }
    
    // Check if text file
    if (!isTextFile(filePath)) {
      return {
        path: relativePath,
        status: "skipped",
        reason: "Not a text file",
      };
    }
    
    // Read content
    const content = await readFile(filePath, "utf-8");
    
    // Skip empty files
    if (!content.trim()) {
      return {
        path: relativePath,
        status: "skipped",
        reason: "Empty file",
      };
    }
    
    // Generate title
    const titleFromContent = extractTitleFromContent(content);
    const title = titleFromContent || generateTitleFromFilename(filePath);
    
    // Create material
    const result = await createMaterial({
      type: "text",
      title,
      content,
      tagNames: tags,
    });
    
    return {
      path: relativePath,
      status: "success",
      id: result.id,
      url: result.url,
    };
  } catch (err) {
    return {
      path: relativePath,
      status: "failed",
      reason: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export const importCommand = new Command("import")
  .description("Import files or directories to TagTime")
  .argument("<paths...>", "Files, directories, or glob patterns to import")
  .option("-r, --recursive", "Import directories recursively")
  .option("--tags <tags>", "Comma-separated tags to add to all items")
  .option("--ignore <pattern>", "Glob pattern to ignore (can be repeated)", (val, prev: string[]) => [...prev, val], [])
  .option("--dry-run", "Preview what would be imported without actually importing")
  .option("--concurrency <n>", "Number of parallel uploads", "5")
  .option("-q, --quiet", "Minimal output")
  .option("--json", "Output results as JSON")
  .action(async (
    paths: string[],
    options: {
      recursive?: boolean;
      tags?: string;
      ignore: string[];
      dryRun?: boolean;
      concurrency: string;
      quiet?: boolean;
      json?: boolean;
    }
  ) => {
    if (!isLoggedIn()) {
      error("Not logged in. Use: tt login --token <your-api-key>");
      process.exit(1);
    }

    const spinner = options.quiet ? null : ora("Scanning files...").start();
    
    // Collect files
    const files = await collectFiles(paths, !!options.recursive, options.ignore);
    
    if (files.length === 0) {
      spinner?.stop();
      error("No files found to import.");
      process.exit(1);
    }
    
    spinner?.stop();
    
    if (!options.quiet && !options.json) {
      info(`Found ${files.length} file(s) to import.`);
    }
    
    // Dry run: just show what would be imported
    if (options.dryRun) {
      if (options.json) {
        console.log(JSON.stringify({ files, count: files.length }, null, 2));
      } else {
        console.log(chalk.bold("\nWould import:"));
        files.forEach((f) => {
          console.log(`  ${f.replace(process.cwd() + "/", "")}`);
        });
        console.log(chalk.dim(`\n  Total: ${files.length} file(s)`));
      }
      return;
    }
    
    // Parse tags
    const tags = options.tags
      ? options.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;
    
    // Import files with concurrency control
    const concurrency = Math.max(1, Math.min(10, parseInt(options.concurrency, 10) || 5));
    const results: ImportResult[] = [];
    const stats: ImportStats = { total: files.length, success: 0, skipped: 0, failed: 0 };
    
    // Process in batches
    const importSpinner = options.quiet ? null : ora(`Importing 0/${files.length}...`).start();
    
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((file) => importFile(file, tags))
      );
      
      for (const result of batchResults) {
        results.push(result);
        stats[result.status]++;
        
        if (!options.quiet && !options.json && !importSpinner) {
          // Show individual results if not using spinner
          const icon = result.status === "success" ? chalk.green("✓")
            : result.status === "skipped" ? chalk.yellow("⊘")
            : chalk.red("✗");
          console.log(`${icon} ${result.path}${result.reason ? chalk.dim(` (${result.reason})`) : ""}`);
        }
      }
      
      if (importSpinner) {
        importSpinner.text = `Importing ${Math.min(i + concurrency, files.length)}/${files.length}...`;
      }
    }
    
    importSpinner?.stop();
    
    // Output results
    if (options.json) {
      console.log(JSON.stringify({ results, stats }, null, 2));
    } else if (!options.quiet) {
      console.log("");
      
      // Show individual results
      for (const result of results) {
        const icon = result.status === "success" ? chalk.green("✓")
          : result.status === "skipped" ? chalk.yellow("⊘")
          : chalk.red("✗");
        const suffix = result.reason ? chalk.dim(` (${result.reason})`) : "";
        console.log(`  ${icon} ${result.path}${suffix}`);
      }
      
      console.log("");
      console.log(chalk.bold("Results:"));
      console.log(`  Imported: ${chalk.green(stats.success)}`);
      if (stats.skipped > 0) {
        console.log(`  Skipped:  ${chalk.yellow(stats.skipped)}`);
      }
      if (stats.failed > 0) {
        console.log(`  Failed:   ${chalk.red(stats.failed)}`);
      }
    } else {
      // Quiet mode: just show summary
      console.log(`Imported: ${stats.success}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`);
    }
    
    // Exit with error code if any failures
    if (stats.failed > 0) {
      process.exit(1);
    }
  });
