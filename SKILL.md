# TagTime CLI - Agent Skill

This skill enables you to interact with local Obsidian/Logseq vaults or TagTime's cloud-based knowledge management system through the `tt` command-line tool.

## Overview

TagTime CLI allows you to save notes, search your knowledge base, and retrieve materials directly from the terminal. It supports two modes:
- **Local mode**: Work with local Obsidian, Logseq, or Markdown folders
- **Cloud mode**: Sync with TagTime cloud service

This is useful for:
- Quickly saving code snippets, ideas, or research notes
- Searching through your local vault or cloud knowledge base
- Retrieving previously saved materials
- Batch importing/exporting files

## Prerequisites

### Local Mode (Obsidian/Logseq)
```bash
# Check current mode
tt mode

# Add a local vault
tt vault add <name> <path>
tt vault add obsidian ~/Documents/Obsidian/MyVault

# Switch to local mode
tt mode local
```

### Cloud Mode
The CLI must be configured with authentication:
```bash
tt whoami

# If not authenticated:
tt login
```

## Work Mode Commands

```bash
# View current mode
tt mode

# Switch to local mode (requires vault)
tt mode local

# Switch to cloud mode
tt mode cloud
```

## Vault Management (Local Mode)

```bash
# Add a vault (auto-detects Obsidian/Logseq)
tt vault add <name> <path>
tt vault add notes ~/Documents/Obsidian/Vault
tt vault add logseq ~/Documents/Logseq --type logseq

# List all vaults
tt vault list

# Set default vault
tt vault use <name>

# Show vault info
tt vault info

# Remove vault (does not delete files)
tt vault remove <name>
```

**When to use**: When user wants to configure which local vault to work with.

## Available Commands

### Save Content

Save text content to vault (local) or TagTime (cloud):
```bash
# Save a quick note
tt save "Your note content here"

# Save with title
tt save "Content" --title "My Note Title"

# Save with tags
tt save "Content" --tags "tag1,tag2"

# Save from a file
tt save /path/to/file.md

# Save from stdin (useful for piping)
echo "piped content" | tt save
cat file.txt | tt save --title "From File"
git diff | tt save --title "Today's changes"

# Local mode specific options
tt save "content" --folder "Projects"     # Save to specific folder
tt save "Today's log" --daily             # Append to daily note

# Quiet mode - only output ID/path
tt save "content" --quiet
```

**When to use**: When the user wants to save notes, code snippets, ideas, or any text content to their knowledge base.

### Search Materials

Search through the knowledge base:
```bash
# Basic search
tt search "keyword"

# Limit results
tt search "docker" --limit 5

# Local mode: search in specific folder
tt search "rust" --folder "Programming"

# JSON output (for programmatic use)
tt search "api" --json
```

**When to use**: When the user wants to find previously saved notes or materials.

### Get Material by ID/Path

Retrieve a specific material:
```bash
# Get by reference number from search results
tt get @1
tt get @2

# Cloud mode: Get by ID
tt get abc123def456
tt get abc123de

# Local mode: Get by path
tt get "Programming/rust-notes.md"

# Save to file
tt get @1 --output ./local-file.md
```

**When to use**: When the user wants to view or download a specific material from search results.

### List Recent Materials

View recently added materials (cloud mode):
```bash
# List recent materials
tt recent

# Limit results
tt recent --limit 5

# JSON output
tt recent --json
```

**When to use**: When the user wants to see their most recently saved materials.

### Import Files (Batch)

Import multiple files or directories to TagTime:
```bash
# Import multiple files
tt import ./notes/*.md

# Import directory recursively
tt import ./notes/ --recursive

# Add tags to all imported items
tt import ./docs/ --tags "imported,work"

# Preview without importing
tt import ./vault/ --dry-run

# Ignore certain files
tt import ./notes/ --ignore "*.draft.md" --ignore "temp/*"

# JSON output
tt import ./notes/ --json
```

**When to use**: When the user wants to bulk import local notes, migrate from other apps, or backup local files to TagTime.

### Export Materials (Batch)

Export materials to local files:
```bash
# Export all materials
tt export -o ./backup/

# Export as JSON
tt export -o ./backup/ --format json

# Filter by tag
tt export -o ./work-notes/ --tag "work"

# Filter by search query
tt export -o ./backup/ --search "project"

# Include metadata (frontmatter)
tt export -o ./backup/ --include-metadata

# Custom filename template
tt export -o ./backup/ --filename-template "{date}-{title}"
# Available placeholders: {id}, {title}, {date}, {type}, {tag}

# Preview without exporting
tt export -o ./backup/ --dry-run

# Limit number of exports
tt export -o ./backup/ --limit 50
```

**When to use**: When the user wants to backup their notes, export for use in other apps, or create local copies.

### Authentication

```bash
# Check current login status
tt whoami

# Interactive login (opens browser)
tt login

# Login with API token
tt login --token <api-key>

# Specify custom server
tt login --base-url https://tagtime.ai
```

### Skill Management

Manage the Claude Code SKILL.md integration:
```bash
# Install SKILL.md to ~/.claude/skills/tagtime-cli/
tt skill install

# Force reinstall (update to latest version)
tt skill install --force

# Check installation status
tt skill status

# List all installed Claude Code skills
tt skill list

# Uninstall SKILL.md
tt skill uninstall

# Display SKILL.md content
tt skill show

# Get installation path
tt skill path
```

**When to use**: When setting up or managing Claude Code AI assistance for TagTime CLI.

## Output Formats

### Human-readable (default)
```
$ tt search "rust"
Found 3 result(s):

@1 Rust 所有权笔记
   ID: abc123de... | Type: text
   ...所有权模型很有意思...
@2 Cargo 配置技巧
   ID: def456gh... | Type: text
   ...
```

### JSON (with --json flag)
```json
{
  "success": true,
  "data": {
    "total": 3,
    "items": [
      {"id": "abc123de", "title": "Rust 所有权笔记", "type": "text"}
    ]
  }
}
```

## Common Workflows

### Local Vault Workflow (Obsidian/Logseq)
```bash
# Setup vault
tt vault add notes ~/Documents/Obsidian/MyVault
tt mode local

# Search and retrieve
tt search "rust ownership"
tt get @1

# Save new notes
tt save "Quick idea about project" --title "Project Idea" --folder "Ideas"
git diff | tt save --title "Today's changes" --folder "Dev"

# Daily notes
tt save "Finished feature X" --daily
```

### Cloud Save and Retrieve
```bash
# Save a note
tt save "Important meeting notes about Project X" --title "Project X Meeting" --tags "meeting,project-x"

# Later, search for it
tt search "Project X"

# Get the full content
tt get @1
```

### Save Code Snippet
```bash
# Save current file content
cat ./mycode.py | tt save --title "Python Helper Functions" --tags "python,utilities"

# Save command output
docker logs app | tt save --title "Container Logs" --tags "debug"
```

### Research Workflow
```bash
# Search for related notes
tt search "docker compose" --limit 10

# Get detailed content of relevant result
tt get @3 --output ./reference.md
```

### Batch Migration
```bash
# Import from Obsidian vault
tt import ./obsidian-vault/ --recursive --tags "imported,obsidian"

# Export for backup
tt export -o ./backup/ --include-metadata

# Export specific tag
tt export -o ./work-backup/ --tag "work" --format markdown
```

## Error Handling

If you encounter errors:
- `Not logged in`: Run `tt login` first (cloud mode)
- `No vault configured`: Run `tt vault add <name> <path>` (local mode)
- `Not found`: Check the material ID/path is correct
- `Network error`: Check internet connection (cloud mode)
- `File too large`: Files over 1MB are not supported

## Tips for Agents

1. **Check current mode first** with `tt mode` to know if working locally or in cloud
2. **For local vaults**: Use `tt vault list` to see available vaults
3. **Use `--json` flag** when you need to parse output programmatically
4. **Use reference numbers** like `@1`, `@2` from search results for quick access
5. **Pipe content** for saving multi-line text: `echo "content" | tt save`
6. **Use meaningful titles and tags** to make content easier to find later
7. **Use `--dry-run`** with import/export to preview operations before executing
8. **Use `--quiet`** with save to get just the ID/path for scripting
9. **Use `--folder`** in local mode to organize notes into directories
10. **Use `--daily`** to append to daily notes (great for logging)
