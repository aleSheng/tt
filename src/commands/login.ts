import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import open from "open";
import { verifyApiKey, initiateDeviceFlow, pollForToken } from "../lib/api.js";
import { setApiKey, setUser, setBaseUrl, getBaseUrl } from "../lib/config.js";
import { success, error, info } from "../lib/output.js";

export const loginCommand = new Command("login")
  .description("Login to TagTime (interactive or with API key)")
  .option("-t, --token <api-key>", "Your TagTime API key (skips interactive flow)")
  .option("--base-url <url>", "Custom API base URL (for development)")
  .option("--no-browser", "Don't automatically open browser")
  .action(async (options: { token?: string; baseUrl?: string; browser?: boolean }) => {
    try {
      // Set custom base URL if provided
      if (options.baseUrl) {
        setBaseUrl(options.baseUrl);
      }

      const baseUrl = getBaseUrl();

      // If token is provided, use direct API key login
      if (options.token) {
        const spinner = ora("Verifying API key...").start();
        
        try {
          const result = await verifyApiKey(options.token, baseUrl);
          setApiKey(options.token);
          setUser(result.user);
          spinner.stop();
          success(`Logged in as ${result.user.email}`);
        } catch (err) {
          spinner.stop();
          if (err instanceof Error) {
            error(`Login failed: ${err.message}`);
          } else {
            error("Login failed: Unknown error");
          }
          process.exit(1);
        }
        return;
      }

      // Interactive Device Flow login
      info("Starting interactive login...\n");
      
      const deviceFlowSpinner = ora("Initializing device authorization...").start();
      
      let deviceResponse;
      try {
        deviceResponse = await initiateDeviceFlow(baseUrl);
        deviceFlowSpinner.stop();
      } catch (err) {
        deviceFlowSpinner.stop();
        if (err instanceof Error) {
          error(`Failed to start login: ${err.message}`);
        } else {
          error("Failed to start login: Unknown error");
        }
        process.exit(1);
      }

      // Display the user code prominently
      console.log();
      console.log(chalk.bold("  To authorize this device:"));
      console.log();
      console.log(`  1. Visit: ${chalk.cyan(deviceResponse.verification_uri)}`);
      console.log();
      console.log(`  2. Enter code: ${chalk.bold.yellow(deviceResponse.user_code)}`);
      console.log();

      // Try to open browser automatically
      if (options.browser !== false) {
        try {
          await open(deviceResponse.verification_uri_complete);
          info("Browser opened automatically. If it didn't, use the URL above.\n");
        } catch {
          info("Couldn't open browser. Please visit the URL manually.\n");
        }
      }

      // Poll for authorization
      const pollSpinner = ora("Waiting for authorization...").start();
      
      try {
        const token = await pollForToken(
          baseUrl,
          deviceResponse.device_code,
          deviceResponse.interval,
          deviceResponse.expires_in
        );
        
        pollSpinner.text = "Verifying...";
        
        // Verify the token and get user info
        const result = await verifyApiKey(token, baseUrl);
        setApiKey(token);
        setUser(result.user);
        
        pollSpinner.stop();
        console.log();
        success(`Logged in as ${result.user.email}`);
        info("\nYour API key has been saved. You can now use other TagTime CLI commands.");
      } catch (err) {
        pollSpinner.stop();
        console.log();
        if (err instanceof Error) {
          error(`Authorization failed: ${err.message}`);
        } else {
          error("Authorization failed: Unknown error");
        }
        process.exit(1);
      }
    } catch (err) {
      if (err instanceof Error) {
        error(`Login failed: ${err.message}`);
      } else {
        error("Login failed: Unknown error");
      }
      process.exit(1);
    }
  });
