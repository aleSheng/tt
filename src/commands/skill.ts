import { Command } from "commander";
import { readFile, writeFile, mkdir, rm, stat, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { success, error, warn, info } from "../lib/output.js";

// 支持的 AI 平台
type AITarget = "claude" | "codex" | "cursor" | "copilot" | "all";

interface TargetConfig {
  name: string;
  description: string;
  getPath: (cwd?: string) => string;
  fileName: string;
}

const TARGET_CONFIGS: Record<Exclude<AITarget, "all">, TargetConfig> = {
  claude: {
    name: "Claude Code",
    description: "Claude Code / Anthropic Claude",
    getPath: () => join(homedir(), ".claude", "skills", "tagtime-cli", "SKILL.md"),
    fileName: "SKILL.md",
  },
  codex: {
    name: "Codex CLI",
    description: "OpenAI Codex CLI / OpenCode",
    getPath: (cwd = process.cwd()) => join(cwd, "AGENTS.md"),
    fileName: "AGENTS.md",
  },
  cursor: {
    name: "Cursor",
    description: "Cursor AI Editor",
    getPath: (cwd = process.cwd()) => join(cwd, ".cursor", "rules", "tagtime.mdc"),
    fileName: "tagtime.mdc",
  },
  copilot: {
    name: "GitHub Copilot",
    description: "GitHub Copilot",
    getPath: (cwd = process.cwd()) => join(cwd, ".github", "copilot-instructions.md"),
    fileName: "copilot-instructions.md",
  },
};

const ALL_TARGETS: Exclude<AITarget, "all">[] = ["claude", "codex", "cursor", "copilot"];

// Legacy constants for backward compatibility
const CLAUDE_SKILLS_DIR = join(homedir(), ".claude", "skills");
const SKILL_NAME = "tagtime-cli";
const SKILL_DIR = join(CLAUDE_SKILLS_DIR, SKILL_NAME);
const SKILL_FILE = join(SKILL_DIR, "SKILL.md");

// 获取包内置的 SKILL.md 路径
function getBuiltinSkillPath(): string {
  // tsup 打包后是单文件在 dist/index.js
  // 所以需要从 dist/ 向上一级到包根目录
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "..", "SKILL.md");
}

// 检查 Skill 是否已安装
async function isSkillInstalled(): Promise<boolean> {
  try {
    await stat(SKILL_FILE);
    return true;
  } catch {
    return false;
  }
}

// 获取已安装的 Skill 版本（从文件头部提取）
async function getInstalledVersion(): Promise<string | null> {
  try {
    const content = await readFile(SKILL_FILE, "utf-8");
    const match = content.match(/^<!-- version: (.+) -->$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// 获取内置 Skill 版本
async function getBuiltinVersion(): Promise<string> {
  // 从 package.json 读取版本
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(currentDir, "..", "package.json");
  try {
    const content = await readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

// 生成特定平台的内容
function generateTargetContent(baseContent: string, target: Exclude<AITarget, "all">, version: string): string {
  // 移除已有的版本标记
  let content = baseContent.replace(/^<!-- version: .+ -->\n?/, "");
  
  // 根据平台调整内容
  switch (target) {
    case "cursor":
      // Cursor 使用 .mdc 格式，需要添加 frontmatter
      return `---
description: TagTime CLI - Save and search notes from terminal
globs: 
alwaysApply: false
---
<!-- version: ${version} -->

${content}`;
    
    case "copilot":
      // GitHub Copilot 格式
      return `<!-- version: ${version} -->
<!-- TagTime CLI Instructions for GitHub Copilot -->

${content}`;
    
    case "codex":
      // Codex/OpenCode AGENTS.md 格式
      return `<!-- version: ${version} -->
<!-- TagTime CLI Agent Instructions -->

${content}`;
    
    default:
      // Claude 默认格式
      return `<!-- version: ${version} -->\n${content}`;
  }
}

// 安装到指定平台
async function installToTarget(target: Exclude<AITarget, "all">, force = false, cwd?: string): Promise<string> {
  const config = TARGET_CONFIGS[target];
  const targetPath = config.getPath(cwd);
  const builtinPath = getBuiltinSkillPath();
  const version = await getBuiltinVersion();
  
  // 检查内置 SKILL.md 是否存在
  try {
    await stat(builtinPath);
  } catch {
    throw new Error(`Built-in SKILL.md not found at ${builtinPath}`);
  }
  
  // 检查是否已安装
  try {
    await stat(targetPath);
    if (!force) {
      throw new Error(
        `${config.name} instructions already exist at ${targetPath}. ` +
        `Use --force to overwrite.`
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
  
  // 创建目录
  await mkdir(dirname(targetPath), { recursive: true });
  
  // 读取基础内容并生成平台特定内容
  const baseContent = await readFile(builtinPath, "utf-8");
  const content = generateTargetContent(baseContent, target, version);
  
  // 写入文件
  await writeFile(targetPath, content, "utf-8");
  
  return targetPath;
}

// 从指定平台卸载
async function uninstallFromTarget(target: Exclude<AITarget, "all">, cwd?: string): Promise<string> {
  const config = TARGET_CONFIGS[target];
  const targetPath = config.getPath(cwd);
  
  try {
    await stat(targetPath);
  } catch {
    throw new Error(`${config.name} instructions not found at ${targetPath}`);
  }
  
  // Claude 删除整个目录，其他只删除文件
  if (target === "claude") {
    await rm(dirname(targetPath), { recursive: true });
  } else {
    await rm(targetPath);
  }
  
  return targetPath;
}

// 检查指定平台的安装状态
async function getTargetStatus(target: Exclude<AITarget, "all">, cwd?: string): Promise<{
  installed: boolean;
  path: string;
  version: string | null;
}> {
  const config = TARGET_CONFIGS[target];
  const targetPath = config.getPath(cwd);
  
  try {
    await stat(targetPath);
    const content = await readFile(targetPath, "utf-8");
    const match = content.match(/^<!-- version: (.+) -->$/m);
    return {
      installed: true,
      path: targetPath,
      version: match ? match[1] : null,
    };
  } catch {
    return {
      installed: false,
      path: targetPath,
      version: null,
    };
  }
}

// 安装 Skill (保留旧函数以兼容)
async function installSkill(force = false): Promise<void> {
  const builtinPath = getBuiltinSkillPath();
  const version = await getBuiltinVersion();
  
  // 检查内置 SKILL.md 是否存在
  try {
    await stat(builtinPath);
  } catch {
    throw new Error(`Built-in SKILL.md not found at ${builtinPath}`);
  }
  
  // 检查是否已安装
  const installed = await isSkillInstalled();
  if (installed && !force) {
    const installedVersion = await getInstalledVersion();
    throw new Error(
      `Skill already installed (version: ${installedVersion || "unknown"}). ` +
      `Use --force to overwrite.`
    );
  }
  
  // 创建目录
  await mkdir(SKILL_DIR, { recursive: true });
  
  // 读取并添加版本标记
  let content = await readFile(builtinPath, "utf-8");
  
  // 在文件开头添加版本注释（不影响 Markdown 渲染）
  if (!content.startsWith("<!-- version:")) {
    content = `<!-- version: ${version} -->\n${content}`;
  } else {
    // 更新版本
    content = content.replace(/^<!-- version: .+ -->/, `<!-- version: ${version} -->`);
  }
  
  // 写入文件
  await writeFile(SKILL_FILE, content, "utf-8");
}

// 卸载 Skill
async function uninstallSkill(): Promise<void> {
  const installed = await isSkillInstalled();
  if (!installed) {
    throw new Error("Skill is not installed");
  }
  
  // 删除整个目录
  await rm(SKILL_DIR, { recursive: true });
}

// 列出所有已安装的 Skills
async function listSkills(): Promise<Array<{ name: string; path: string }>> {
  try {
    const entries = await readdir(CLAUDE_SKILLS_DIR, { withFileTypes: true });
    const skills: Array<{ name: string; path: string }> = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = join(CLAUDE_SKILLS_DIR, entry.name, "SKILL.md");
        try {
          await stat(skillPath);
          skills.push({ name: entry.name, path: skillPath });
        } catch {
          // SKILL.md 不存在，跳过
        }
      }
    }
    
    return skills;
  } catch {
    return [];
  }
}

export const skillCommand = new Command("skill")
  .description("Manage AI agent instructions for Claude, Codex, Cursor, and GitHub Copilot")
  .addCommand(
    new Command("install")
      .description("Install AI instructions to specified platform(s)")
      .option("-f, --force", "Overwrite existing installation")
      .option("-t, --target <target>", "Target platform: claude, codex, cursor, copilot, or all", "claude")
      .action(async (options: { force?: boolean; target?: string }) => {
        const target = (options.target || "claude") as AITarget;
        
        if (target !== "all" && !ALL_TARGETS.includes(target as Exclude<AITarget, "all">)) {
          error(`Invalid target: ${target}. Use: claude, codex, cursor, copilot, or all`);
          process.exit(1);
        }
        
        const targets = target === "all" ? ALL_TARGETS : [target as Exclude<AITarget, "all">];
        const results: { target: string; success: boolean; path?: string; error?: string }[] = [];
        
        for (const t of targets) {
          try {
            const path = await installToTarget(t, options.force);
            results.push({ target: t, success: true, path });
          } catch (err) {
            results.push({ target: t, success: false, error: (err as Error).message });
          }
        }
        
        console.log();
        console.log(chalk.bold("Installation Results"));
        console.log();
        
        for (const r of results) {
          const config = TARGET_CONFIGS[r.target as Exclude<AITarget, "all">];
          if (r.success) {
            console.log(`  ${chalk.green("✓")} ${config.name}`);
            console.log(chalk.dim(`    ${r.path}`));
          } else {
            console.log(`  ${chalk.red("✗")} ${config.name}`);
            console.log(chalk.dim(`    ${r.error}`));
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        if (successCount > 0) {
          console.log();
          info(`${successCount} platform(s) configured. You may need to restart your AI tool.`);
        }
      })
  )
  .addCommand(
    new Command("uninstall")
      .description("Remove AI instructions from specified platform(s)")
      .option("-t, --target <target>", "Target platform: claude, codex, cursor, copilot, or all", "claude")
      .action(async (options: { target?: string }) => {
        const target = (options.target || "claude") as AITarget;
        
        if (target !== "all" && !ALL_TARGETS.includes(target as Exclude<AITarget, "all">)) {
          error(`Invalid target: ${target}. Use: claude, codex, cursor, copilot, or all`);
          process.exit(1);
        }
        
        const targets = target === "all" ? ALL_TARGETS : [target as Exclude<AITarget, "all">];
        
        for (const t of targets) {
          try {
            const path = await uninstallFromTarget(t);
            success(`Removed ${TARGET_CONFIGS[t].name} instructions from ${path}`);
          } catch (err) {
            if (target !== "all") {
              error((err as Error).message);
              process.exit(1);
            }
            // For "all", silently skip not installed targets
          }
        }
      })
  )
  .addCommand(
    new Command("status")
      .description("Check installation status across all platforms")
      .option("-t, --target <target>", "Target platform: claude, codex, cursor, copilot, or all", "all")
      .action(async (options: { target?: string }) => {
        const target = (options.target || "all") as AITarget;
        const builtinVersion = await getBuiltinVersion();
        const targets = target === "all" ? ALL_TARGETS : [target as Exclude<AITarget, "all">];
        
        console.log(chalk.bold("TagTime CLI AI Agent Status"));
        console.log(chalk.dim(`Built-in version: ${builtinVersion}`));
        console.log();
        
        for (const t of targets) {
          const config = TARGET_CONFIGS[t];
          const status = await getTargetStatus(t);
          
          console.log(`  ${config.name} ${chalk.dim(`(${config.description})`)}`);
          if (status.installed) {
            console.log(`    ${chalk.green("●")} Installed (v${status.version || "unknown"})`);
            console.log(chalk.dim(`    ${status.path}`));
            if (status.version && status.version !== builtinVersion) {
              warn(`    Update available. Run: tt skill install -t ${t} --force`);
            }
          } else {
            console.log(`    ${chalk.dim("○")} Not installed`);
            console.log(chalk.dim(`    Install: tt skill install -t ${t}`));
          }
          console.log();
        }
      })
  )
  .addCommand(
    new Command("list")
      .description("List all installed Claude Code skills")
      .action(async () => {
        const skills = await listSkills();
        
        console.log(chalk.bold("Installed Claude Code Skills"));
        console.log();
        
        if (skills.length === 0) {
          console.log(chalk.dim("  No skills installed"));
          console.log();
          info(`Install TagTime skill with: tt skill install`);
        } else {
          for (const skill of skills) {
            const isCurrent = skill.name === SKILL_NAME;
            const marker = isCurrent ? chalk.green("●") : chalk.dim("○");
            const name = isCurrent ? chalk.green(skill.name) : skill.name;
            console.log(`  ${marker} ${name}`);
            console.log(chalk.dim(`    ${skill.path}`));
          }
        }
      })
  )
  .addCommand(
    new Command("path")
      .description("Print the skill installation path")
      .option("-t, --target <target>", "Target platform: claude, codex, cursor, copilot", "claude")
      .action((options: { target?: string }) => {
        const target = (options.target || "claude") as Exclude<AITarget, "all">;
        if (!ALL_TARGETS.includes(target)) {
          error(`Invalid target: ${target}. Use: claude, codex, cursor, or copilot`);
          process.exit(1);
        }
        console.log(TARGET_CONFIGS[target].getPath());
      })
  )
  .addCommand(
    new Command("show")
      .description("Display the SKILL.md content")
      .action(async () => {
        const builtinPath = getBuiltinSkillPath();
        try {
          const content = await readFile(builtinPath, "utf-8");
          console.log(content);
        } catch {
          error("Could not read SKILL.md");
          process.exit(1);
        }
      })
  );

// 默认行为：显示所有平台状态
skillCommand.action(async () => {
  const builtinVersion = await getBuiltinVersion();
  
  console.log(chalk.bold("TagTime CLI - AI Agent Integration"));
  console.log(chalk.dim(`Built-in version: ${builtinVersion}`));
  console.log();
  
  console.log(chalk.bold("Supported Platforms:"));
  console.log();
  
  for (const t of ALL_TARGETS) {
    const config = TARGET_CONFIGS[t];
    const status = await getTargetStatus(t);
    
    const marker = status.installed ? chalk.green("●") : chalk.dim("○");
    const statusText = status.installed 
      ? chalk.green(`Installed (v${status.version || "unknown"})`)
      : chalk.dim("Not installed");
    
    console.log(`  ${marker} ${config.name} - ${statusText}`);
  }
  
  console.log();
  console.log(chalk.dim("Commands:"));
  console.log(chalk.dim("  tt skill install -t <target>   Install to platform (claude/codex/cursor/copilot/all)"));
  console.log(chalk.dim("  tt skill install -t all        Install to all platforms"));
  console.log(chalk.dim("  tt skill uninstall -t <target> Remove from platform"));
  console.log(chalk.dim("  tt skill status                Check all platforms"));
  console.log(chalk.dim("  tt skill show                  Display instructions content"));
});
