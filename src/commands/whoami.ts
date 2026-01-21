import { Command } from "commander";
import { getConfig, isLoggedIn } from "../lib/config.js";
import { success, error, info } from "../lib/output.js";

export const whoamiCommand = new Command("whoami")
  .description("Show current logged in user")
  .action(async () => {
    if (!isLoggedIn()) {
      error("Not logged in. Use: tt login --token <your-api-key>");
      process.exit(1);
    }

    const config = getConfig();

    if (config.user) {
      success(`Logged in as: ${config.user.email}`);
      if (config.user.name) {
        info(`Name: ${config.user.name}`);
      }
      info(`User ID: ${config.user.id}`);
      info(`API Base URL: ${config.baseUrl}`);
    } else {
      info("Logged in (user details not cached)");
      info(`API Base URL: ${config.baseUrl}`);
    }
  });
