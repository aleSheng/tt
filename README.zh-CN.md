# TagTime CLI (`tt`)

> AI Agent 的外部记忆系统。从终端保存决策、搜索上下文、构建知识库。

当前版本: 0.1.5 · [GitHub](https://github.com/aleSheng/tt) · [English](./README.md)

## 为什么需要 tt？

**AI 是无状态的，但你的项目不是。**

每次开启新的 AI 对话，上下文都会丢失：
- *"我们决定用 Zod 做校验是因为..."* — 忘了
- *"API 错误格式应该是..."* — 又要解释一遍
- *"这个项目不要用 default export"* — AI 不知道

**tt 给 AI 持久化的记忆。**

```bash
# 保存一个项目决策
tt save "用 Zod 做校验 - 比 Yup 的 TS 类型推断更好" --title "校验库选择"

# 之后，AI（或你）可以检索它
tt search "校验"
tt get @1
```

支持本地文件夹、Obsidian/Logseq 库，或 TagTime 云端。本地优先，离线可用。

---

## 快速开始

```bash
# 1. 添加笔记文件夹（任意文件夹都行）
tt vault add notes ~/Documents/notes
tt mode local

# 2. 保存知识
tt save "这个项目统一用 pnpm，不要用 npm" --title "包管理器"

# 3. 检索上下文
tt search "包管理器"
tt get @1

# 云端模式（跨设备同步）
tt login
tt save "你的笔记"
```

## AI Agent 如何使用 tt

```bash
# AI 在编码过程中保存决策
tt save "选择 Prisma 而不是 Drizzle - 团队更熟悉 Prisma" --tags "decisions"

# AI 在开始任务前检索上下文
tt search "数据库 orm"

# AI 记录学到的东西
git diff | tt save --title "Auth 重构 - 抽取了 useToken hook"
```

**为你的 AI 助手安装技能：**
```bash
tt skill install              # Claude Code（默认）
tt skill install -t cursor    # Cursor
tt skill install -t copilot   # GitHub Copilot
tt skill install -t all       # 所有平台
```

---

## 核心命令

### Save — 捕获知识

```bash
tt save "内容"                         # 快速保存
tt save "内容" --title "标题"          # 带标题
tt save "内容" --tags "tag1,tag2"      # 带标签
tt save ./file.md                      # 保存文件
echo "内容" | tt save                  # 管道输入

# 捕获命令输出
git log --oneline -10 | tt save --title "最近提交"
git diff | tt save --title "今日改动"
```

### Search — 查找上下文

```bash
tt search "关键词"                     # 全文搜索（模糊匹配）
tt search "校验库"                     # 语义化搜索
tt search "auth" --folder "decisions"  # 按文件夹过滤
tt search "api" --tag "conventions"    # 按标签过滤
tt search "关键词" --json              # JSON 输出（给 AI 用）
```

### Get — 获取内容

```bash
tt get @1                   # 获取上次搜索的第一条结果
tt get @2                   # 获取第二条
tt get "path/to/note.md"    # 按路径获取
tt get @1 --raw             # 只输出内容，无格式
```

---

## 本地模式

支持**任意本地文件夹** — 纯 Markdown、Obsidian 或 Logseq。

## Vault 管理

```bash
# 添加 vault
tt vault add <名称> <路径>
tt vault add notes ~/Documents/notes          # 纯 Markdown
tt vault add obsidian ~/Obsidian/Vault        # 自动检测 Obsidian
tt vault add logseq ~/Logseq/Graph            # 自动检测 Logseq

# 管理
tt vault list
tt vault use <名称>
tt vault info
tt vault remove <名称>

# 切换模式
tt mode              # 显示当前模式
tt mode local        # 本地模式
tt mode cloud        # 云端模式
```

---

## 云端模式

通过 TagTime 云端跨设备同步。

```bash
# 认证
tt login                  # 交互式登录
tt login --token KEY      # API key 登录
tt whoami                 # 查看状态

# Save/Search/Get — 与本地模式相同
tt save "内容" --title "标题"
tt search "关键词"
tt get @1

# 最近
tt recent                 # 列出最近
tt recent -n 5

# 批量操作
tt import ./notes/*.md              # 导入文件
tt import ./notes/ -r               # 递归导入
tt export -o ./backup/              # 导出全部
tt export -o ./backup/ --tag "work" # 按标签导出
```

---

## 管道输入

非常适合捕获命令输出：

```bash
git log --oneline -10 | tt save --title "最近提交"
git diff | tt save --title "改动"
docker logs app | tt save --tags "debug"
curl https://api.example.com | tt save -t "API 响应"
pbpaste | tt save --title "从剪贴板"  # macOS
```

---

## AI Agent 集成

让 AI 助手使用 tt 作为外部记忆：

```bash
tt skill install              # Claude Code（默认）
tt skill install -t cursor    # Cursor
tt skill install -t codex     # OpenAI Codex CLI / OpenCode
tt skill install -t copilot   # GitHub Copilot
tt skill install -t all       # 所有平台

tt skill status               # 检查安装状态
tt skill uninstall -t all     # 移除
```

| 平台 | 文件位置 |
|------|----------|
| Claude Code | `~/.claude/skills/tagtime-cli/SKILL.md` |
| Codex / OpenCode | `./AGENTS.md` |
| Cursor | `./.cursor/rules/tagtime.mdc` |
| GitHub Copilot | `./.github/copilot-instructions.md` |

---

## 配置

配置文件: `~/.config/tagtime/config.json`

---

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发模式
pnpm build          # 构建
pnpm test           # 测试
```

---

## 理念

传统笔记工具存储信息，供人类日后阅读。

**tt 存储上下文，供 AI 当下使用。**

在 vibe coding 时代，你的知识库不只是给你自己用的 — 它是帮你写代码的 AI Agent 的工作记忆。每一个保存的决策，都是不需要重复解释的上下文。

```
人类保存决策 → tt 存储 → AI 检索 → 更好的代码
```
