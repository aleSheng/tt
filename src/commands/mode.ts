import { Command } from "commander";
import chalk from "chalk";
import {
  getMode,
  setMode,
  isLoggedIn,
  getCurrentVault,
  hasVaults,
  type WorkMode,
} from "../lib/config.js";
import { expandPath } from "../lib/local/vault.js";
import { success, error, info } from "../lib/output.js";

export const modeCommand = new Command("mode")
  .description("View or switch work mode (local/cloud)")
  .argument("[mode]", "Mode to switch to: local or cloud")
  .option("--vault <name>", "Specify vault when switching to local mode")
  .action((mode?: string, options?: { vault?: string }) => {
    // 无参数：显示当前模式
    if (!mode) {
      const currentMode = getMode();
      
      console.log();
      console.log(chalk.bold("Current mode: ") + chalk.cyan(currentMode));
      
      if (currentMode === "local") {
        const vault = getCurrentVault();
        if (vault) {
          console.log(chalk.bold("Active vault: ") + chalk.green(vault.name));
          console.log(chalk.gray(`  Type: ${vault.type}`));
          console.log(chalk.gray(`  Path: ${expandPath(vault.path)}`));
        } else {
          console.log(chalk.yellow("No vault configured. Add one with: tt vault add <name> <path>"));
        }
      } else {
        if (isLoggedIn()) {
          console.log(chalk.green("✓ Logged in to TagTime cloud"));
        } else {
          console.log(chalk.yellow("Not logged in. Use: tt login"));
        }
      }
      
      console.log();
      console.log(chalk.gray("Switch mode with: tt mode local | tt mode cloud"));
      console.log();
      return;
    }
    
    // 验证模式参数
    if (mode !== "local" && mode !== "cloud") {
      error("Invalid mode. Use: local or cloud");
      process.exit(1);
    }
    
    const newMode = mode as WorkMode;
    
    // 切换到本地模式
    if (newMode === "local") {
      if (!hasVaults()) {
        error("No vaults configured. Add one first with: tt vault add <name> <path>");
        process.exit(1);
      }
      
      setMode("local");
      
      const vault = getCurrentVault();
      success(`Switched to local mode`);
      if (vault) {
        console.log(chalk.gray(`  Active vault: ${vault.name} (${vault.type})`));
        console.log(chalk.gray(`  Path: ${expandPath(vault.path)}`));
      }
      return;
    }
    
    // 切换到云端模式
    if (newMode === "cloud") {
      setMode("cloud");
      success("Switched to cloud mode");
      
      if (!isLoggedIn()) {
        console.log(chalk.yellow("Note: Not logged in. Use: tt login"));
      }
      return;
    }
  });
