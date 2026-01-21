import { Command } from "commander";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import ora from "ora";
import chalk from "chalk";
import { createMaterial, ApiError } from "../lib/api.js";
import { isLoggedIn, isLocalMode, getCurrentVault, getVault } from "../lib/config.js";
import { success, error, warn } from "../lib/output.js";
import { saveNote } from "../lib/local/notes.js";

// Content size limits
const MAX_CONTENT_SIZE = 1024 * 1024; // 1MB
const WARN_CONTENT_SIZE = 100 * 1024; // 100KB

interface SaveOptions {
  title?: string;
  tags?: string;
  quiet?: boolean;
  json?: boolean;
  folder?: string;
  daily?: boolean;
  vault?: string;
}

// Read from stdin with improved handling
async function readStdin(): Promise<string | null> {
  // Check if stdin is a TTY (interactive terminal)
  if (process.stdin.isTTY) {
    return null;
  }
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    
    process.stdin.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_CONTENT_SIZE) {
        process.stdin.destroy();
        reject(new Error(`Content too large (>${MAX_CONTENT_SIZE / 1024 / 1024}MB). Consider saving to a file first.`));
        return;
      }
      chunks.push(chunk);
    });
    
    process.stdin.on("end", () => {
      const content = Buffer.concat(chunks).toString("utf-8").trim();
      resolve(content || null);
    });
    
    process.stdin.on("error", (err) => {
      reject(err);
    });
  });
}

// Detect content type from content
function detectContentType(content: string): "text" | "markdown" | "code" {
  // Markdown features
  if (/^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|^```|^\|.*\|/.test(content)) {
    return "markdown";
  }
  // Code features (common language patterns)
  if (/^(import|export|function|const|let|var|class|def|async|package|public|private)\s/m.test(content)) {
    return "code";
  }
  return "text";
}

// Generate a title from content
function generateTitle(content: string, maxLength = 50): string {
  // Try to find a heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].slice(0, maxLength);
  }
  
  // Use first line or first N characters
  const firstLine = content.split("\n")[0].trim();
  if (firstLine.length <= maxLength) {
    return firstLine;
  }
  return firstLine.slice(0, maxLength - 3) + "...";
}

export const saveCommand = new Command("save")
  .description("Save content or file to TagTime")
  .argument("[content]", "Content to save (text or file path). Use stdin if not provided.")
  .option("-t, --title <title>", "Title for the material")
  .option("--tags <tags>", "Comma-separated list of tags")
  .option("-q, --quiet", "Only output the saved material ID/path")
  .option("--json", "Output result as JSON")
  .option("--folder <path>", "Target folder (local mode)")
  .option("--daily", "Save to daily note (local mode)")
  .option("--vault <name>", "Specify vault (local mode)")
  .action(async (content: string | undefined, options: SaveOptions) => {
    // 本地模式
    if (isLocalMode()) {
      const vault = options.vault ? getVault(options.vault) : getCurrentVault();
      
      if (!vault) {
        error("No vault configured. Add one with: tt vault add <name> <path>");
        process.exit(1);
      }

      let inputContent = content;
      let isFromStdin = false;

      // Try to read from stdin if no content provided
      if (!inputContent) {
        try {
          const stdinContent = await readStdin();
          if (stdinContent) {
            inputContent = stdinContent;
            isFromStdin = true;
          } else {
            error("No content provided. Provide content as argument or pipe via stdin.");
            process.exit(1);
          }
        } catch (err) {
          error(err instanceof Error ? err.message : "Failed to read from stdin");
          process.exit(1);
        }
      }

      const spinner = options.quiet ? null : ora("Saving to vault...").start();

      try {
        let finalContent = inputContent;
        let title = options.title;

        // Check if content is a file path (only if not from stdin)
        if (!isFromStdin) {
          const filePath = resolve(inputContent);
          try {
            const fileStat = await stat(filePath);
            if (fileStat.isFile()) {
              finalContent = await readFile(filePath, "utf-8");
              if (!title) {
                title = basename(filePath, ".md");
              }
            }
          } catch {
            // Not a file, treat as text content
          }
        }

        // Parse tags
        const tags = options.tags
          ? options.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined;

        const result = await saveNote(finalContent, vault, {
          title,
          folder: options.folder,
          tags,
          daily: options.daily,
        });

        spinner?.stop();

        if (options.json) {
          console.log(JSON.stringify({ success: true, data: result }, null, 2));
        } else if (options.quiet) {
          console.log(result.path);
        } else {
          console.log(chalk.green("✓") + ` Saved to ${chalk.cyan(result.path)}`);
        }
      } catch (err) {
        spinner?.stop();
        error(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
        process.exit(1);
      }
      return;
    }

    // 云端模式
    if (!isLoggedIn()) {
      error("Not logged in. Use: tt login --token <your-api-key>");
      process.exit(1);
    }

    let inputContent = content;
    let isFromStdin = false;

    // Try to read from stdin if no content provided
    if (!inputContent) {
      try {
        const stdinContent = await readStdin();
        if (stdinContent) {
          inputContent = stdinContent;
          isFromStdin = true;
        } else {
          error("No content provided. Provide content as argument or pipe via stdin.");
          process.exit(1);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to read from stdin");
        process.exit(1);
      }
    }

    // Check content size and warn if large
    const contentSize = Buffer.byteLength(inputContent, "utf-8");
    if (contentSize > WARN_CONTENT_SIZE) {
      warn(`Content is large (${(contentSize / 1024).toFixed(1)}KB). This may take a moment...`);
    }

    const spinner = options.quiet ? null : ora("Saving...").start();

    try {
      let finalContent = inputContent;
      let title = options.title;
      let type: "text" | "link" = "text";

      // Check if content is a file path (only if not from stdin)
      if (!isFromStdin) {
        const filePath = resolve(inputContent);
        try {
          const fileStat = await stat(filePath);
          if (fileStat.isFile()) {
            // Check file size
            if (fileStat.size > MAX_CONTENT_SIZE) {
              spinner?.stop();
              error(`File too large (>${MAX_CONTENT_SIZE / 1024 / 1024}MB). Maximum size is 1MB.`);
              process.exit(1);
            }
            // Read file content
            finalContent = await readFile(filePath, "utf-8");
            // Use filename as default title if not provided
            if (!title) {
              title = basename(filePath);
            }
          }
        } catch {
          // Not a file, treat as text content
        }
      }

      // Check if content is a URL
      if (finalContent.match(/^https?:\/\//i)) {
        type = "link";
        if (!title) {
          title = finalContent;
        }
      }

      // Auto-generate title if not provided
      if (!title) {
        title = generateTitle(finalContent);
      }

      // Parse tags
      const tagNames = options.tags
        ? options.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;

      // Create material
      const result = await createMaterial({
        type,
        title,
        content: finalContent,
        tagNames,
      });

      spinner?.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (options.quiet) {
        console.log(result.id);
      } else {
        success(`Saved! ID: ${result.id}`);
        console.log(`  View at: ${result.url}`);
      }
    } catch (err) {
      spinner?.stop();
      if (err instanceof ApiError) {
        error(`Failed to save: ${err.message}`);
      } else if (err instanceof Error) {
        error(`Failed to save: ${err.message}`);
      } else {
        error("Failed to save: Unknown error");
      }
      process.exit(1);
    }
  });
