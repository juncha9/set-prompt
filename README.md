# Set Prompt 🏠

As you work with AI agents, you build up your own prompt set — skills, commands, and workflows tailored to how you work.

But every time you try a new AI agent, you have to set it all up again from scratch. And as your prompts evolve, keeping them in sync across multiple tools becomes a maintenance burden that the tools themselves don't help with.

`set-prompt` was built to solve this. It maintains a single git repository of prompts and symlinks them into each tool's expected location — so your prompt set stays in one place, stays versioned, and stays consistent across every AI agent you use.

```
my-prompts/ (git repo)
    └── skills/, commands/, hooks/
            ↓ set-prompt install <git-url>
            ↓ set-prompt link claudecode   →  ~/.set-prompt/claudecode/    (Claude Code plugin)
            ↓ set-prompt link roocode       →  ~/.roo/                     (symlinks)
            ↓ set-prompt link openclaw      →  ~/.openclaw/workspace/      (symlinks)
```

## 📦 Installation

```bash
npm install -g set-prompt
# or use without installing
npx set-prompt <command>
```

## 🚀 Workflow

### 1. Create a prompt repository

```bash
mkdir my-prompts && cd my-prompts && git init
set-prompt scaffold .
```

Creates:

```
my-prompts/
├── SET_PROMPT_GUIDE.md
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
├── commands/
│   └── <command-name>/
│       └── COMMAND.md
├── hooks/
└── agents/
```

### 2. Register the repository

```bash
# remote git URL — cloned to ~/.set-prompt/repo/
set-prompt install https://github.com/you/my-prompts
```

### 3. Link to AI tools 🔗

```bash
set-prompt link              # interactive selection
set-prompt link claudecode  # Claude Code only
set-prompt link roocode      # RooCode only
```

- **Claude Code**: creates a plugin at `~/.set-prompt/claudecode/`, registers via `~/.claude/settings.json`
- **RooCode**: symlinks `skills/`, `commands/` into `~/.roo/` — backs up existing dirs first
- **OpenClaw**: symlinks `skills/` into `~/.openclaw/workspace/` — backs up existing dir first

## 📋 Commands

| Command | Description | Status |
|---------|-------------|--------|
| `scaffold [path]` | Verify and scaffold repo structure | ✅ |
| `install <url>` | Clone remote git repo and register as prompt source | ✅ |
| `link [agent]` | Link prompts to AI agents (interactive if omitted) | ✅ |
| `link claudecode` | Link to Claude Code | ✅ |
| `link roocode` | Link to RooCode | ✅ |
| `link openclaw` | Link to OpenClaw | ✅ |
| `link codex` | Link to Codex | 🔜 planned |
| `link antigravity` | Link to Antigravity | 🔜 planned |
| `update` | Fetch and pull latest changes from remote repo | ✅ |
| `status` | Show current repo and linked agents | ✅ |
| `uninstall` | Remove all set-prompt data | ✅ |

## 🗓️ Planned Integrations

| Agent | Provider | Status |
|-------|----------|--------|
| Codex | OpenAI | 🔜 planned |
| Antigravity | Google | 🔜 planned |

## ☕ Support

`set-prompt` is a solo side project. I have a full-time job, so there are weeks where I can't touch it — but I read every issue and do my best to respond as quickly as I can. Your support genuinely makes a difference in how much time I can dedicate to this.

**Ways to help:**

- ⭐ **Star this repo** — the simplest thing, and it helps more than you'd think
- 🐛 **Report bugs** — open an [issue](https://github.com/juncha9/set-prompt/issues) with steps to reproduce
- 💡 **Request features** — share ideas or use cases via [issues](https://github.com/juncha9/set-prompt/issues)
- 🔧 **Submit a PR** — new agent integrations (Codex, Antigravity, ...) are especially welcome
- ☕ **Sponsor** — if `set-prompt` saves you time, buying me a coffee means I can keep working on it

[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=github-sponsors)](https://github.com/sponsors/juncha9)

## 💻 Dev Commands

```bash
npx tsx src/index.ts <command>   # Run without building
npm run build                    # tsup + copy templates
npm link                         # Register as global CLI (set-prompt)
npm unlink -g set-prompt         # Remove global CLI
npm test                         # Run tests with vitest
.\tests\test-cli.ps1             # Integration tests (PowerShell)
```

## ⚠️ Warning

`set-prompt` modifies configuration files managed by third-party AI agent applications:

- **Claude Code** — writes to `~/.claude/settings.json`
- **RooCode** — replaces directories in `~/.roo/`
- **OpenClaw** — replaces directories in `~/.openclaw/workspace/`

Before making any changes, `set-prompt` creates a backup and rolls back automatically on failure. However, you should be aware that:

- Modifying these files may conflict with future updates to the target agent
- If a rollback also fails, the backup path is printed — you can restore manually

Use `set-prompt uninstall` to cleanly revert all changes.

## 📁 What Gets Created

Stored at `~/.set-prompt/config.json`, managed via `ConfigManager`.

```
~/.set-prompt/
├── config.json          # repo_path, remote_url, linked agent state
├── repo/                # remote repos cloned here
│   └── <repo-name>/
│       ├── skills/
│       ├── commands/
│       └── hooks/
└── claudecode/         # Claude Code plugin output
    ├── .claude-plugin/
    │   └── marketplace.json
    └── plugins/set-prompt/
        ├── .claude-plugin/plugin.json
        ├── skills/      → symlink to repo/skills/
        ├── commands/    → symlink to repo/commands/
        └── hooks/       → symlink to repo/hooks/

~/.roo/                  # RooCode integration (symlinks)
├── SET_PROMPT_BACKUP/  # backup of original dirs before linking
│   ├── skills/
│   └── commands/
├── skills/              → symlink to repo/skills/
└── commands/            → symlink to repo/commands/

~/.openclaw/workspace/   # OpenClaw integration (symlinks)
├── SET_PROMPT_BACKUP/  # backup of original dirs before linking
│   └── skills/
└── skills/              → symlink to repo/skills/
```

## 🖥️ Requirements

- **Node.js** 18+
- **Git** (must be available in `PATH` for `set-prompt install`)
- **Windows**: symlink creation requires either Developer Mode enabled or running as Administrator

## 🤝 Contributing

> Contribution guidelines are still being figured out. For now, feel free to open an issue to discuss ideas or report bugs.

- Bug reports and feature requests → [GitHub Issues](https://github.com/juncha9/set-prompt/issues)
- PRs for new agent integrations (OpenClaw, Codex, Antigravity, etc.) are especially appreciated

## 📄 License

This project is licensed under the [MIT License](./LICENSE.md).
© 2026 [juncha9](https://github.com/juncha9)
