#!/usr/bin/env node

// Post-install script to remind users about SKILL.md
// This runs after npm install

const isCI = process.env.CI === 'true' || process.env.CONTINUOUS_INTEGRATION === 'true';
const isNpmLifecycle = process.env.npm_lifecycle_event === 'postinstall';

// Check if terminal supports colors (most modern terminals do)
const supportsColor = process.stdout.isTTY && (
  process.env.TERM !== 'dumb' ||
  process.platform === 'win32' // Windows Terminal, PowerShell, and modern CMD support ANSI
);

// ANSI codes (fallback to empty if not supported)
const cyan = supportsColor ? '\x1b[36m' : '';
const yellow = supportsColor ? '\x1b[33m' : '';
const bold = supportsColor ? '\x1b[1m' : '';
const reset = supportsColor ? '\x1b[0m' : '';

// Use ASCII-safe box characters for maximum compatibility
const boxChars = {
  topLeft: '+',
  topRight: '+',
  bottomLeft: '+',
  bottomRight: '+',
  horizontal: '-',
  vertical: '|',
};

// Only show message in interactive installs, not CI
if (!isCI && isNpmLifecycle) {
  const width = 56;
  const line = boxChars.horizontal.repeat(width);
  
  console.log();
  console.log(`${cyan}${boxChars.topLeft}${line}${boxChars.topRight}${reset}`);
  console.log(`${cyan}${boxChars.vertical}${reset}  ${bold}TagTime CLI installed successfully!${reset}                 ${cyan}${boxChars.vertical}${reset}`);
  console.log(`${cyan}${boxChars.vertical}${reset}                                                        ${cyan}${boxChars.vertical}${reset}`);
  console.log(`${cyan}${boxChars.vertical}${reset}  To enable Claude Code AI assistance, run:            ${cyan}${boxChars.vertical}${reset}`);
  console.log(`${cyan}${boxChars.vertical}${reset}  ${yellow}tt skill install${reset}                                     ${cyan}${boxChars.vertical}${reset}`);
  console.log(`${cyan}${boxChars.vertical}${reset}                                                        ${cyan}${boxChars.vertical}${reset}`);
  console.log(`${cyan}${boxChars.vertical}${reset}  Get started:                                         ${cyan}${boxChars.vertical}${reset}`);
  console.log(`${cyan}${boxChars.vertical}${reset}  ${yellow}tt login${reset}     - Authenticate with TagTime              ${cyan}${boxChars.vertical}${reset}`);
  console.log(`${cyan}${boxChars.vertical}${reset}  ${yellow}tt --help${reset}    - See all commands                       ${cyan}${boxChars.vertical}${reset}`);
  console.log(`${cyan}${boxChars.topLeft}${line}${boxChars.bottomRight}${reset}`);
  console.log();
}
