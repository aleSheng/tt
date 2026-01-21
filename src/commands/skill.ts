import { Command } from "commander";
import { readFile, writeFile, mkdir, rm, stat, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { success, error, warn, info } from "../lib/output.js";

// Skill 安装目录
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

// 安装 Skill
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
  .description("Manage Claude Code SKILL.md for AI assistance")
  .addCommand(
    new Command("install")
      .description("Install SKILL.md to ~/.claude/skills/tagtime-cli/")
      .option("-f, --force", "Overwrite existing installation")
      .action(async (options: { force?: boolean }) => {
        try {
          await installSkill(options.force);
          success(`Skill installed to ${SKILL_FILE}`);
          info("Claude Code will now recognize TagTime CLI commands.");
          console.log();
          console.log(chalk.dim("You may need to restart Claude Code for changes to take effect."));
        } catch (err) {
          error((err as Error).message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("uninstall")
      .description("Remove SKILL.md from Claude Code")
      .action(async () => {
        try {
          await uninstallSkill();
          success("Skill uninstalled successfully");
        } catch (err) {
          error((err as Error).message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("status")
      .description("Check if SKILL.md is installed")
      .action(async () => {
        const installed = await isSkillInstalled();
        const builtinVersion = await getBuiltinVersion();
        
        console.log(chalk.bold("TagTime CLI Skill Status"));
        console.log();
        
        if (installed) {
          const installedVersion = await getInstalledVersion();
          console.log(`  ${chalk.green("●")} Installed`);
          console.log(`  Version: ${installedVersion || "unknown"}`);
          console.log(`  Path: ${SKILL_FILE}`);
          
          if (installedVersion && installedVersion !== builtinVersion) {
            console.log();
            warn(`A newer version (${builtinVersion}) is available. Run: tt skill install --force`);
          }
        } else {
          console.log(`  ${chalk.red("○")} Not installed`);
          console.log();
          info(`Install with: tt skill install`);
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
      .action(() => {
        console.log(SKILL_FILE);
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

// 默认行为：显示状态
skillCommand.action(async () => {
  // 运行 status 子命令
  const installed = await isSkillInstalled();
  const builtinVersion = await getBuiltinVersion();
  
  console.log(chalk.bold("TagTime CLI Skill"));
  console.log();
  
  if (installed) {
    const installedVersion = await getInstalledVersion();
    console.log(`  Status: ${chalk.green("Installed")}`);
    console.log(`  Version: ${installedVersion || "unknown"}`);
    console.log(`  Path: ${SKILL_FILE}`);
    
    if (installedVersion && installedVersion !== builtinVersion) {
      console.log();
      warn(`Update available (${builtinVersion}). Run: tt skill install --force`);
    }
  } else {
    console.log(`  Status: ${chalk.yellow("Not installed")}`);
    console.log();
    console.log("  Install the skill to enable Claude Code AI assistance:");
    console.log(chalk.cyan("    tt skill install"));
  }
  
  console.log();
  console.log(chalk.dim("Available commands:"));
  console.log(chalk.dim("  tt skill install    Install SKILL.md"));
  console.log(chalk.dim("  tt skill uninstall  Remove SKILL.md"));
  console.log(chalk.dim("  tt skill status     Check installation status"));
  console.log(chalk.dim("  tt skill list       List all Claude skills"));
  console.log(chalk.dim("  tt skill show       Display SKILL.md content"));
});
