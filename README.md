# Set Prompt 🏠

As you work with AI agents, you build up your own prompt set — skills, commands, and workflows tailored to how you work.

But every time you try a new AI agent, you have to set it all up again from scratch. And as your prompts evolve, keeping them in sync across multiple tools becomes a maintenance burden that the tools themselves don't help with.

`set-prompt` was built to solve this. It maintains a single git repository of prompts and symlinks them into each tool's expected location — so your prompt set stays in one place, stays versioned, and stays consistent across every AI agent you use.

One repo. Every agent. Always in sync.

```
                        my-prompts/ (git repo)
                        ├── skills/
                        ├── commands/
                        └── hooks/
                               │
              ┌────────────────┼─────────────────┬─────────────────┐
              ▼                ▼                  ▼                 ▼
    ~/.set-prompt/         ~/.roo/         ~/.openclaw/      ~/.gemini/
    claudecode/                            workspace/        antigravity/
    (Claude Code plugin)   (symlinks)      (symlinks)        (symlinks)
```

## 📦 Installation

```bash
npm install -g set-prompt
# or use without installing
npx set-prompt <command>
```

## 🚀 Workflow

### Step 1 — Install set-prompt

```bash
npm install -g set-prompt
```

Or run without installing:

```bash
npx set-prompt <command>
```

---

### Step 2 — Connect your prompt repository

Point `set-prompt` at a git repo containing your prompts. It clones it to `~/.set-prompt/repo/` and registers it as your prompt source.

```bash
set-prompt install https://github.com/you/my-prompts
```

Don't have a repo yet? Scaffold one first:

```bash
mkdir my-prompts && cd my-prompts && git init
set-prompt scaffold .
```

This creates the expected directory structure:

```
my-prompts/
├── skills/
├── commands/
├── hooks/
└── agents/
```

---

### Step 3 — Link to AI agents 🔗

```bash
set-prompt link              # interactive checkbox — select agents to link
set-prompt link claudecode   # link Claude Code only
set-prompt link roocode      # link RooCode only
set-prompt link openclaw     # link OpenClaw only
set-prompt link antigravity  # link Antigravity only
set-prompt link cursor       # link Cursor only
```

The interactive mode shows all agents with their current state. **Check to link, uncheck to unlink** — existing directories are backed up before being replaced.

| Agent | Where prompts land | What gets linked |
|---|---|---|
| Claude Code | `~/.set-prompt/claude-code/` (plugin) | `skills/`, `commands/`, `hooks/`, `agents/` |
| RooCode | `~/.roo/` | `skills/`, `commands/` |
| OpenClaw | `~/.openclaw/workspace/` | `skills/` |
| Antigravity | `~/.gemini/antigravity/` | `skills/` |
| Cursor | `~/.cursor/` (plugin) | `skills/`, `commands/` |

---

### Step 4 — Uninstall

Removes all set-prompt data, reverts symlinks, and restores any backed-up directories.

```bash
set-prompt uninstall
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `install <url>` | Clone remote git repo and register as prompt source |
| `link [agent]` | Link/unlink agents interactively, or target one directly |
| `update` | Fetch and pull latest changes from remote repo |
| `status` | Show current repo and linked agents |
| `scaffold [path]` | Verify and create required directories in a prompt repo |
| `uninstall` | Remove all set-prompt data and restore backups |

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

- **Claude Code** — writes to `~/.claude/settings.json` and `~/.claude/plugins/installed_plugins.json`
- **RooCode** — replaces directories in `~/.roo/`
- **OpenClaw** — replaces directories in `~/.openclaw/workspace/`
- **Cursor** — writes to `~/.cursor/`

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
└── claude-code/        # Claude Code plugin output
    ├── .claude-plugin/
    │   └── marketplace.json
    └── plugins/sppt/
        ├── .claude-plugin/plugin.json
        ├── skills/      → symlink to repo/skills/
        ├── commands/    → symlink to repo/commands/
        ├── hooks/       → symlink to repo/hooks/
        └── agents/      → symlink to repo/agents/

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

~/.gemini/antigravity/   # Antigravity integration (symlinks)
├── SET_PROMPT_BACKUP/  # backup of original dirs before linking
│   └── skills/
└── skills/              → symlink to repo/skills/
```

## 🖥️ Requirements

- **Node.js** 18+
- **Git** (must be available in `PATH` for `set-prompt install`)
- **Windows only**: symlink creation requires Developer Mode enabled or running as Administrator (Linux/macOS work out of the box)

## 🤝 Contributing

> Contribution guidelines are still being figured out. For now, feel free to open an issue to discuss ideas or report bugs.

- Bug reports and feature requests → [GitHub Issues](https://github.com/juncha9/set-prompt/issues)
- PRs for new agent integrations (OpenClaw, Codex, Antigravity, etc.) are especially appreciated

## 📄 License

This project is licensed under the [MIT License](./LICENSE.md).
© 2026 [juncha9](https://github.com/juncha9)
