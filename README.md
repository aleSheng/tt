# TagTime CLI (`tt`)

> Save and search notes from terminal. Works with local folders, Obsidian/Logseq, or TagTime cloud.
> Current version: 0.1.3 · GitHub: https://github.com/aleSheng/tt

- Local-first: index plain folders, Obsidian vaults, and Logseq graphs (works offline).


## Quick Start

```bash
# Local mode - any folder works!
tt vault add notes ~/Documents/notes    # Plain folder
tt vault add obsidian ~/Obsidian/Vault  # Or Obsidian vault
tt mode local
tt search "keyword"
tt get @1
tt save "Quick note" --title "Idea"

# Cloud mode
tt login
tt save "Your note"
tt search "keyword"
```

## Local Mode

Work with **any local folder** - no need for Obsidian or cloud services.

```bash
# Add any folder as vault
tt vault add <name> <path>
tt vault add notes ~/Documents/notes          # Plain markdown folder
tt vault add work ~/Projects/work-notes       # Any folder works
tt vault add obsidian ~/Obsidian/Vault        # Auto-detects Obsidian
tt vault add logseq ~/Logseq/Graph            # Auto-detects Logseq

# Manage vaults
tt vault list
tt vault use <name>
tt vault info
tt vault remove <name>

# Switch modes
tt mode              # Show current mode
tt mode local        # Switch to local
tt mode cloud        # Switch to cloud

# Local operations
tt search "keyword"                    # Full-text search (fuzzy + prefix)
tt search "javascrpt"                  # Fuzzy match → "javascript"
tt search "type"                       # Prefix match → "typescript"
tt search "rust" --folder "Programming"
tt search "guide" --tag tutorial       # Filter by tag
tt search "keyword" --exact            # Exact match only
tt search "keyword" --rebuild-index    # Force rebuild index
tt get @1                              # Get search result
tt get "path/to/note.md"               # Get by path
tt save "content" --title "Note"       # Save note
tt save "log" --folder "Daily" --daily # Append to daily note
```

## Cloud Mode Commands

```bash
# Auth
tt login                  # Interactive login
tt login --token KEY      # API key login
tt whoami                 # Check login status

# Save
tt save "content"         # Save text
tt save "content" --title "Title" --tags "tag1,tag2"
tt save ./file.md         # Save file
echo "content" | tt save  # Pipe input
git diff | tt save -t "Changes"  # Pipe with title

# Search
tt search "keyword"       # Search
tt search "keyword" -n 5  # Limit results
tt search "keyword" --json

# Get
tt get @1                 # Get Nth result from last search
tt get abc123             # Get by ID
tt get @1 -o ./out.md     # Save to file

# Recent
tt recent                 # List recent items
tt recent -n 5 --json

# Import
tt import ./notes/*.md    # Import multiple files
tt import ./notes/ -r     # Import directory recursively
tt import ./docs/ --tags "work" --dry-run

# Export
tt export -o ./backup/    # Export all to directory
tt export -o ./backup/ --tag "work"  # Export by tag
tt export -o ./backup/ --format json --include-metadata
```

## Pipe Input Examples

```bash
# Save command output
git log --oneline -10 | tt save --title "Recent commits"
docker logs app | tt save --tags "docker,debug"
curl https://api.example.com | tt save -t "API Response"

# Save clipboard (macOS)
pbpaste | tt save --title "From clipboard"

# Save with auto-generated title
cat README.md | tt save
```

## Batch Import

```bash
# Import markdown files
tt import ./notes/*.md

# Import directory recursively
tt import ./vault/ --recursive --tags "imported"

# Preview without importing
tt import ./docs/ --dry-run

# Ignore certain files
tt import ./notes/ --ignore "*.draft.md" --ignore "temp/*"
```

## Export

```bash
# Export all materials
tt export -o ./backup/

# Export with filters
tt export -o ./work/ --tag "work"
tt export -o ./backup/ --search "project"

# Export as JSON with metadata
tt export -o ./data/ --format json --include-metadata

# Custom filename template
tt export -o ./backup/ --filename-template "{date}-{title}"
```

## AI Agent Integration

Install instructions for your preferred AI coding assistant:

```bash
# Install to Claude Code (default)
tt skill install

# Install to specific platform
tt skill install -t claude      # Claude Code → ~/.claude/skills/
tt skill install -t codex       # OpenAI Codex CLI / OpenCode → ./AGENTS.md
tt skill install -t cursor      # Cursor → ./.cursor/rules/
tt skill install -t copilot     # GitHub Copilot → ./.github/copilot-instructions.md

# Install to all platforms at once
tt skill install -t all

# Check status across all platforms
tt skill status

# Uninstall
tt skill uninstall -t claude    # Remove from specific platform
tt skill uninstall -t all       # Remove from all platforms
```

| Platform | File Location |
|----------|---------------|
| Claude Code | `~/.claude/skills/tagtime-cli/SKILL.md` |
| Codex CLI / OpenCode | `./AGENTS.md` (project root) |
| Cursor | `./.cursor/rules/tagtime.mdc` |
| GitHub Copilot | `./.github/copilot-instructions.md` |

This enables AI assistants to understand and use TagTime CLI commands.

## Config

Config file: `~/.config/tagtime/config.json`

## Development

```bash
pnpm install        # Install dependencies
pnpm dev            # Dev mode
pnpm build          # Build
pnpm test           # Test
```
