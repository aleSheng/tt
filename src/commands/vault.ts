import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  addVault,
  removeVault,
  getVaults,
  getVault,
  setDefaultVault,
  getDefaultVaultName,
  type VaultConfig,
} from "../lib/config.js";
import {
  detectVaultType,
  validateVaultPath,
  expandPath,
  countNotes,
  getVaultInfo,
  getDefaultVaultConfig,
} from "../lib/local/vault.js";
import { success, error, info, warn } from "../lib/output.js";

// ==================== vault add ====================
const addCommand = new Command("add")
  .description("Add a local vault")
  .argument("<name>", "Name for the vault")
  .argument("<path>", "Path to the vault directory")
  .option("-t, --type <type>", "Vault type: obsidian, logseq, markdown")
  .action(async (name: string, path: string, options: { type?: string }) => {
    // 验证路径
    const validation = validateVaultPath(path);
    if (!validation.valid) {
      error(validation.error!);
      process.exit(1);
    }
    
    // 检查是否已存在
    if (getVault(name)) {
      error(`Vault "${name}" already exists. Use a different name or remove it first.`);
      process.exit(1);
    }
    
    // 检测或使用指定类型
    let type: VaultConfig["type"];
    if (options.type) {
      if (!["obsidian", "logseq", "markdown"].includes(options.type)) {
        error("Invalid type. Use: obsidian, logseq, or markdown");
        process.exit(1);
      }
      type = options.type as VaultConfig["type"];
    } else {
      type = detectVaultType(path);
    }
    
    const spinner = ora("Adding vault...").start();
    
    try {
      // 获取默认配置
      const vaultConfig = getDefaultVaultConfig(path, type);
      
      // 统计笔记数量
      const noteCount = await countNotes(path, type);
      
      // 添加到配置
      addVault(name, vaultConfig);
      
      spinner.stop();
      
      const typeLabel = type === "obsidian" ? "Obsidian vault" :
                       type === "logseq" ? "Logseq graph" : "Markdown folder";
      
      console.log(chalk.green("✓") + ` Added vault "${chalk.bold(name)}" (${typeLabel})`);
      console.log(chalk.gray(`  Path: ${expandPath(path)}`));
      console.log(chalk.gray(`  Notes: ${noteCount} files`));
      
      if (Object.keys(getVaults()).length === 1) {
        console.log(chalk.gray(`  Set as default vault`));
      }
    } catch (err) {
      spinner.stop();
      error(`Failed to add vault: ${err instanceof Error ? err.message : "Unknown error"}`);
      process.exit(1);
    }
  });

// ==================== vault list ====================
const listCommand = new Command("list")
  .alias("ls")
  .description("List all vaults")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    const vaults = getVaults();
    const defaultVault = getDefaultVaultName();
    
    if (Object.keys(vaults).length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ vaults: [] }));
      } else {
        info("No vaults configured. Add one with: tt vault add <name> <path>");
      }
      return;
    }
    
    if (options.json) {
      const result = Object.entries(vaults).map(([name, config]) => ({
        name,
        ...config,
        isDefault: name === defaultVault,
      }));
      console.log(JSON.stringify({ vaults: result }, null, 2));
      return;
    }
    
    // 表格输出
    console.log();
    console.log(
      chalk.gray("NAME".padEnd(15)) +
      chalk.gray("TYPE".padEnd(12)) +
      chalk.gray("PATH".padEnd(45)) +
      chalk.gray("DEFAULT")
    );
    console.log(chalk.gray("-".repeat(80)));
    
    for (const [name, config] of Object.entries(vaults)) {
      const isDefault = name === defaultVault;
      const displayPath = config.path.length > 42 
        ? "..." + config.path.slice(-39) 
        : config.path;
      
      console.log(
        chalk.white(name.padEnd(15)) +
        chalk.cyan(config.type.padEnd(12)) +
        chalk.gray(displayPath.padEnd(45)) +
        (isDefault ? chalk.green("✓") : "")
      );
    }
    console.log();
  });

// ==================== vault use ====================
const useCommand = new Command("use")
  .description("Set default vault")
  .argument("<name>", "Vault name")
  .action((name: string) => {
    if (!setDefaultVault(name)) {
      error(`Vault "${name}" not found. Use 'tt vault list' to see available vaults.`);
      process.exit(1);
    }
    
    success(`Default vault set to "${name}"`);
  });

// ==================== vault remove ====================
const removeCommand = new Command("remove")
  .alias("rm")
  .description("Remove a vault (does not delete files)")
  .argument("<name>", "Vault name")
  .action((name: string) => {
    if (!removeVault(name)) {
      error(`Vault "${name}" not found.`);
      process.exit(1);
    }
    
    success(`Removed vault "${name}" (files not deleted)`);
  });

// ==================== vault info ====================
const infoCommand = new Command("info")
  .description("Show vault details")
  .argument("[name]", "Vault name (defaults to current vault)")
  .action(async (name?: string) => {
    const targetName = name || getDefaultVaultName();
    
    if (!targetName) {
      error("No vault specified and no default vault set.");
      process.exit(1);
    }
    
    const config = getVault(targetName);
    if (!config) {
      error(`Vault "${targetName}" not found.`);
      process.exit(1);
    }
    
    const spinner = ora("Getting vault info...").start();
    
    try {
      const vaultInfo = await getVaultInfo(targetName, config);
      spinner.stop();
      
      const isDefault = targetName === getDefaultVaultName();
      
      console.log();
      console.log(chalk.bold("Vault: ") + chalk.cyan(targetName) + (isDefault ? chalk.green(" (default)") : ""));
      console.log(chalk.bold("Type: ") + config.type);
      console.log(chalk.bold("Path: ") + expandPath(config.path));
      
      if (vaultInfo.noteCount !== undefined) {
        console.log(chalk.bold("Notes: ") + `${vaultInfo.noteCount} files`);
      }
      
      if (vaultInfo.lastModified) {
        console.log(chalk.bold("Last modified: ") + vaultInfo.lastModified.toLocaleString());
      }
      
      // 显示配置详情
      if (config.type === "obsidian") {
        console.log();
        console.log(chalk.gray("Obsidian settings:"));
        if (config.dailyNotesFolder) console.log(chalk.gray(`  Daily notes: ${config.dailyNotesFolder}/`));
        if (config.templatesFolder) console.log(chalk.gray(`  Templates: ${config.templatesFolder}/`));
        if (config.attachmentsFolder) console.log(chalk.gray(`  Attachments: ${config.attachmentsFolder}/`));
      } else if (config.type === "logseq") {
        console.log();
        console.log(chalk.gray("Logseq settings:"));
        if (config.pagesFolder) console.log(chalk.gray(`  Pages: ${config.pagesFolder}/`));
        if (config.journalsFolder) console.log(chalk.gray(`  Journals: ${config.journalsFolder}/`));
      }
      
      console.log();
    } catch (err) {
      spinner.stop();
      error(`Failed to get vault info: ${err instanceof Error ? err.message : "Unknown error"}`);
      process.exit(1);
    }
  });

// ==================== Main vault command ====================
export const vaultCommand = new Command("vault")
  .description("Manage local vaults")
  .addCommand(addCommand)
  .addCommand(listCommand)
  .addCommand(useCommand)
  .addCommand(removeCommand)
  .addCommand(infoCommand);
