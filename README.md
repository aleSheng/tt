# TagTime CLI (`tt`)

> External memory for AI Agents. Save decisions, search context, build knowledge — from terminal.

Current version: 0.1.5 · [GitHub](https://github.com/aleSheng/tt) · [中文](./README.zh-CN.md)

## Why tt?

**AI is stateless. Your projects aren't.**

Every time you start a new AI conversation, context is lost:
- *"We decided to use Zod for validation because..."* — forgotten
- *"The API error format should be..."* — explain again
- *"Don't use default exports in this project"* — AI doesn't know

**tt gives AI persistent memory.**

```bash
# Save a project decision
tt save "Use Zod for validation - better TS inference than Yup" --title "Validation Choice"

# Later, AI (or you) can retrieve it
tt search "validation"
tt get @1
```

Works with local folders, Obsidian/Logseq vaults, or TagTime cloud. Local-first, works offline.

---

## Quick Start

```bash
# 1. Add your notes folder (any folder works)
tt vault add notes ~/Documents/notes
tt mode local

# 2. Save knowledge
tt save "Always use pnpm in this project, not npm" --title "Package Manager"

# 3. Retrieve context
tt search "package manager"
tt get @1

# Cloud mode (sync across devices)
tt login
tt save "Your note"
```

## How AI Agents Use tt

```bash
# AI saves a decision during coding
tt save "Chose Prisma over Drizzle - team familiar with Prisma" --tags "decisions"

# AI retrieves context before starting a task
tt search "database orm"

# AI captures learnings
git diff | tt save --title "Auth refactoring - extracted useToken hook"
```

**Install skill for your AI assistant:**
```bash
tt skill install              # Claude Code (default)
tt skill install -t cursor    # Cursor
tt skill install -t copilot   # GitHub Copilot
tt skill install -t all       # All platforms
```

---

## Core Commands

### Save — Capture knowledge

```bash
tt save "content"                      # Quick save
tt save "content" --title "Title"      # With title
tt save "content" --tags "tag1,tag2"   # With tags
tt save ./file.md                      # Save file
echo "content" | tt save               # Pipe input

# Capture command output
git log --oneline -10 | tt save --title "Recent commits"
git diff | tt save --title "Today's changes"
```

### Search — Find context

```bash
tt search "keyword"                    # Full-text search (fuzzy)
tt search "validation library"         # Semantic-ish search
tt search "auth" --folder "decisions"  # Filter by folder
tt search "api" --tag "conventions"    # Filter by tag
tt search "keyword" --json             # JSON output (for AI)
```

### Get — Retrieve content

```bash
tt get @1                   # Get first result from last search
tt get @2                   # Get second result
tt get "path/to/note.md"    # Get by path
tt get @1 --raw             # Content only, no formatting
```

---

## Local Mode

Work with **any local folder** — plain markdown, Obsidian, or Logseq.

## Vault Management

```bash
# Add vault
tt vault add <name> <path>
tt vault add notes ~/Documents/notes          # Plain markdown
tt vault add obsidian ~/Obsidian/Vault        # Auto-detects Obsidian
tt vault add logseq ~/Logseq/Graph            # Auto-detects Logseq

# Manage
tt vault list
tt vault use <name>
tt vault info
tt vault remove <name>

# Switch modes
tt mode              # Show current
tt mode local        # Local mode
tt mode cloud        # Cloud mode
```

---

## Cloud Mode

Sync across devices with TagTime cloud.

```bash
# Auth
tt login                  # Interactive login
tt login --token KEY      # API key login
tt whoami                 # Check status

# Save/Search/Get — same as local mode
tt save "content" --title "Title"
tt search "keyword"
tt get @1

# Recent
tt recent                 # List recent
tt recent -n 5

# Batch operations
tt import ./notes/*.md              # Import files
tt import ./notes/ -r               # Recursive
tt export -o ./backup/              # Export all
tt export -o ./backup/ --tag "work" # Export filtered
```

---

## Pipe Input

Perfect for capturing command output:

```bash
git log --oneline -10 | tt save --title "Recent commits"
git diff | tt save --title "Changes"
docker logs app | tt save --tags "debug"
curl https://api.example.com | tt save -t "API Response"
pbpaste | tt save --title "From clipboard"  # macOS
```

---

## AI Agent Integration

Let AI assistants use tt as their external memory:

```bash
tt skill install              # Claude Code (default)
tt skill install -t cursor    # Cursor
tt skill install -t codex     # OpenAI Codex CLI / OpenCode
tt skill install -t copilot   # GitHub Copilot
tt skill install -t all       # All platforms

tt skill status               # Check installation
tt skill uninstall -t all     # Remove
```

| Platform | File Location |
|----------|---------------|
| Claude Code | `~/.claude/skills/tagtime-cli/SKILL.md` |
| Codex / OpenCode | `./AGENTS.md` |
| Cursor | `./.cursor/rules/tagtime.mdc` |
| GitHub Copilot | `./.github/copilot-instructions.md` |

---

## Config

Config: `~/.config/tagtime/config.json`

---

## Development

```bash
pnpm install        # Install
pnpm dev            # Dev mode
pnpm build          # Build
pnpm test           # Test
```

---

## Philosophy

Traditional note tools store information for humans to read later.

**tt stores context for AI to use now.**

In the age of vibe coding, your knowledge base isn't just for you — it's working memory for AI agents that help you build software. Every decision saved is context that doesn't need to be re-explained.

```
Human saves decision → tt stores it → AI retrieves it → Better code
```
