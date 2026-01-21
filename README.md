# TagTime CLI (`tt`)

<p align="center">
  <strong>🚀 Save and search notes from your terminal</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#local-mode">Local Mode</a> •
  <a href="#cloud-mode">Cloud Mode</a> •
  <a href="#ai-agent-integration">AI Integration</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@tagtime/cli?color=blue&label=npm" alt="npm version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey" alt="platform" />
</p>

---

Works seamlessly with **any local folder**, **Obsidian**, **Logseq**, or **TagTime cloud**. Lightning-fast full-text search with fuzzy matching powered by MiniSearch.

## ✨ Features

- 📁 **Universal Vault Support** - Plain folders, Obsidian, Logseq, or any markdown-based system
- 🔍 **Smart Search** - Fuzzy matching, prefix search, tag filtering
- ☁️ **Cloud Sync** - Optional TagTime cloud for cross-device access
- 🤖 **AI Ready** - Built-in Claude Code skill for AI-assisted note-taking
- ⚡ **Blazing Fast** - Indexed search across thousands of notes
- 🔧 **Pipe Friendly** - Unix philosophy: works great with `|`

## 📦 Installation

```bash
npm install -g @tagtime/cli
# or
pnpm add -g @tagtime/cli
```

## 🚀 Quick Start


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

## 📂 Local Mode

Work with **any local folder** - no need for Obsidian or cloud services.

### Vault Management

```bash
# Add any folder as vault
tt vault add <name> <path>
tt vault add notes ~/Documents/notes          # Plain markdown folder
tt vault add work ~/Projects/work-notes       # Any folder works
tt vault add obsidian ~/Obsidian/Vault        # Auto-detects Obsidian
tt vault add logseq ~/Logseq/Graph            # Auto-detects Logseq

# Manage vaults
tt vault list                # List all vaults
tt vault use <name>          # Switch active vault
tt vault info                # Show current vault details
tt vault remove <name>       # Remove vault
```

### Mode Switching

```bash
tt mode              # Show current mode
tt mode local        # Switch to local
tt mode cloud        # Switch to cloud
```

### Search & Retrieve

```bash
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

## ☁️ Cloud Mode

### Authentication

```bash
tt login                  # Interactive login
tt login --token KEY      # API key login
tt whoami                 # Check login status
```

### Save Notes

```bash
tt save "content"                              # Save text
tt save "content" --title "Title" --tags "tag1,tag2"
tt save ./file.md                              # Save file
echo "content" | tt save                       # Pipe input
git diff | tt save -t "Changes"                # Pipe with title
```

### Search & Retrieve

```bash
tt search "keyword"       # Search
tt search "keyword" -n 5  # Limit results
tt search "keyword" --json

tt get @1                 # Get Nth result from last search
tt get abc123             # Get by ID
tt get @1 -o ./out.md     # Save to file

tt recent                 # List recent items
tt recent -n 5 --json
```

## 🔄 Import & Export

### Import

```bash
tt import ./notes/*.md                      # Import multiple files
tt import ./vault/ --recursive --tags "imported"  # Recursive
tt import ./docs/ --dry-run                 # Preview without importing
tt import ./notes/ --ignore "*.draft.md"   # Ignore patterns
```

### Export

```bash
tt export -o ./backup/                      # Export all
tt export -o ./work/ --tag "work"           # Filter by tag
tt export -o ./backup/ --search "project"  # Filter by search
tt export -o ./data/ --format json --include-metadata
tt export -o ./backup/ --filename-template "{date}-{title}"
```

## 🔧 Pipe Input Examples

```bash
# Save command output
git log --oneline -10 | tt save --title "Recent commits"
docker logs app | tt save --tags "docker,debug"
curl https://api.example.com | tt save -t "API Response"

# Save clipboard
pbpaste | tt save --title "From clipboard"   # macOS
powershell Get-Clipboard | tt save           # Windows
xclip -selection clipboard -o | tt save      # Linux

# Save with auto-generated title
cat README.md | tt save
```

## 🤖 🤖 AI Agent Integration

Install the Claude Code skill for seamless AI assistance:

```bash
tt skill install      # Install SKILL.md
tt skill status       # Check status
tt skill list         # List all installed skills
tt skill uninstall    # Uninstall
```

This enables Claude Code to understand and use TagTime CLI commands for AI-assisted note-taking and knowledge management.

## ⚙️ Configuration

Config file location: `~/.config/tagtime/config.json`

| Setting | Description |
|---------|-------------|
| `mode` | Current mode: `local` or `cloud` |
| `activeVault` | Active vault name for local mode |
| `vaults` | List of configured vaults |
| `apiToken` | API token for cloud mode |

## 🛠️ Development

```bash
pnpm install        # Install dependencies
pnpm dev            # Dev mode with watch
pnpm build          # Build for production
pnpm test           # Run tests
pnpm typecheck      # Type checking
```

## 📄 License

MIT © [TagTime](https://tagtime.ai)

---

<p align="center">
  <sub>Made with ❤️ for note-taking enthusiasts</sub>
</p>
