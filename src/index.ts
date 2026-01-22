import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { whoamiCommand } from "./commands/whoami.js";
import { saveCommand } from "./commands/save.js";
import { searchCommand } from "./commands/search.js";
import { getCommand } from "./commands/get.js";
import { recentCommand } from "./commands/recent.js";
import { importCommand } from "./commands/import.js";
import { exportCommand } from "./commands/export.js";
import { skillCommand } from "./commands/skill.js";
import { vaultCommand } from "./commands/vault.js";
import { modeCommand } from "./commands/mode.js";

const program = new Command();

program
  .name("tt")
  .description("TagTime CLI - Save and search notes from terminal")
  .version("0.1.5");

// Register commands
program.addCommand(loginCommand);
program.addCommand(whoamiCommand);
program.addCommand(saveCommand);
program.addCommand(searchCommand);
program.addCommand(recentCommand);
program.addCommand(getCommand);
program.addCommand(importCommand);
program.addCommand(exportCommand);
program.addCommand(skillCommand);
program.addCommand(vaultCommand);
program.addCommand(modeCommand);

program.parse();
