# Set Prompt

As you work with AI agents, you build up your own prompt set — skills, commands, and workflows tailored to how you work.

But every time you try a new AI agent, you have to set it all up again from scratch. And as your prompts evolve, keeping them in sync across multiple tools becomes a maintenance burden that the tools themselves don't help with.

`set-prompt` was built to solve this. It maintains a single git repository of prompts and links them into each tool's expected location — so your prompt set stays in one place, stays versioned, and stays consistent across every AI agent you use.

One repo. Every agent. Always in sync.

```
                    repo/ (git)
                    ├── skills/
                    ├── commands/
                    ├── hooks/
                    ├── agents/
                    ├── rules/
                    ├── .mcp.json
                    ├── .app.json
                    ├── .claude-plugin/plugin.json
                    └── .codex-plugin/plugin.json
                           │
        ┌──────────────────┼──────────────────────┐
        ▼                  ▼                       ▼
  Claude Code          Codex                  RooCode, OpenClaw,
  (marketplace +       (marketplace +         Antigravity, Cursor
   repo symlink)        cache symlink)        (dir symlinks)
```

## Installation

```bash
npm install -g set-prompt
# or use without installing
npx set-prompt <command>
```

## CLI Alias

`sppt` is a built-in short alias for `set-prompt` — all commands work with either name:

```bash
sppt install <url>        # connect an existing repo
sppt link                 # link to AI agents
sppt update               # pull latest changes
```

## Workflow

### Step 1 — Connect your prompt repository

Point `set-prompt` at a git repo containing your prompts. It clones it to `~/.set-prompt/repo/` and registers it as your prompt source.

```bash
set-prompt install https://github.com/you/my-prompts
```

Don't have a repo yet? Scaffold one first:

```bash
mkdir my-prompts && cd my-prompts && git init
set-prompt scaffold .
```

This creates the expected directory structure with plugin manifests:

```
my-prompts/
├── skills/
├── commands/
├── hooks/
├── agents/
├── rules/
├── .mcp.json
├── .app.json
├── .claude-plugin/plugin.json
├── .codex-plugin/plugin.json
└── SET_PROMPT_GUIDE.md          (optional reference doc)
```

---

### Step 2 — Link to AI agents

```bash
set-prompt link              # interactive checkbox — select agents to link
set-prompt link claudecode   # link Claude Code only
set-prompt link roocode      # link RooCode only
set-prompt link openclaw     # link OpenClaw only
set-prompt link codex        # link Codex only
set-prompt link antigravity  # link Antigravity only
set-prompt link cursor       # link Cursor only
```

The interactive mode shows all agents with their current state. **Check to link, uncheck to unlink** — existing directories are backed up before being replaced.

| Agent | Method | What gets linked |
|---|---|---|
| Claude Code | marketplace + repo symlink | repo via `~/.set-prompt/claude-code/plugins/sppt` |
| Codex | marketplace + cache symlink | repo via `~/.agents/plugins/` + `~/.codex/plugins/cache/` |
| RooCode | dir symlinks into `~/.roo/` | `skills/`, `commands/` |
| OpenClaw | dir symlinks into `~/.openclaw/workspace/` | `skills/` |
| Antigravity | dir symlinks into `~/.gemini/antigravity/` | `skills/` |
| Cursor | dir symlinks into `~/.cursor/` | `skills/`, `agents/`, `commands/`, `hooks/`, `mcp.json` (hardlink) |

> **Note on Claude Code**: Operates as a plugin. Restart Claude Code after linking for the plugin to be recognized.

> **Note on Codex**: Operates as a plugin. Restart Codex after linking — you may need to restart **twice** before the plugin is fully recognized.

> **Note on Cursor**: Does not load `rules/` from symlinked directories. Use `.cursor/rules/` within each project instead, or manage rules via Cursor Settings.

---

### Step 3 — Keep in sync

```bash
set-prompt update    # git pull latest changes from remote
```

Symlink-based agents (Claude Code, Codex, RooCode, OpenClaw, Antigravity) reflect changes immediately after pull. Cursor's `mcp.json` is a hardlink to repo's `.mcp.json`, so edits to either side are reflected automatically.

---

### Step 4 — Uninstall

Removes all set-prompt data, reverts symlinks, and restores any backed-up directories.

```bash
set-prompt uninstall
```

## Commands

| Command | Description |
|---------|-------------|
| `install <url>` | Clone remote git repo and register as prompt source |
| `link [agent]` | Link/unlink agents interactively, or target one directly |
| `update` | Fetch and pull latest changes from remote repo |
| `status` | Show current repo and linked agents |
| `scaffold [path]` | Create directories and plugin manifests in a prompt repo |
| `uninstall` | Remove all set-prompt data and restore backups |

## What Gets Created

```
~/.set-prompt/
├── config.json
├── repo/                    # cloned prompt repository
│   ├── skills/
│   ├── commands/
│   ├── hooks/
│   ├── agents/
│   ├── rules/
│   ├── .mcp.json
│   ├── .app.json
│   ├── .claude-plugin/plugin.json
│   └── .codex-plugin/plugin.json
└── claude-code/             # Claude Code marketplace
    ├── .claude-plugin/marketplace.json
    └── plugins/sppt → repo  (symlink)

~/.roo/                      # RooCode (dir symlinks)
├── SET_PROMPT_BACKUP/
├── skills/ → repo/skills
└── commands/ → repo/commands

~/.openclaw/workspace/       # OpenClaw (dir symlinks)
├── SET_PROMPT_BACKUP/
└── skills/ → repo/skills

~/.gemini/antigravity/       # Antigravity (dir symlinks)
├── SET_PROMPT_BACKUP/
└── skills/ → repo/skills

~/.agents/plugins/           # Codex marketplace
└── marketplace.json

~/.codex/
├── config.toml              # plugin enabled
└── plugins/cache/local-repo/sppt/1.0.0 → repo  (symlink)

~/.cursor/                   # Cursor (dir symlinks)
├── SET_PROMPT_BACKUP/
├── skills/ → repo/skills
├── agents/ → repo/agents
├── commands/ → repo/commands
├── hooks/ → repo/hooks
└── mcp.json ⇔ repo/.mcp.json  (hardlink)
```

## Warning

`set-prompt` modifies configuration files managed by third-party AI agent applications:

- **Claude Code** — writes to `~/.claude/settings.json` and `~/.claude/plugins/installed_plugins.json`
- **Codex** — writes to `~/.agents/plugins/marketplace.json` and `~/.codex/config.toml`
- **RooCode** — replaces directories in `~/.roo/`
- **OpenClaw** — replaces directories in `~/.openclaw/workspace/`
- **Antigravity** — replaces directories in `~/.gemini/antigravity/`
- **Cursor** — replaces directories and `mcp.json` in `~/.cursor/`

Before making any changes, `set-prompt` creates a backup and rolls back automatically on failure. However, you should be aware that:

- Modifying these files may conflict with future updates to the target agent
- If a rollback also fails, the backup path is printed — you can restore manually

Use `set-prompt uninstall` to cleanly revert all changes.

## Requirements

- **Node.js** 18+
- **Git** (must be available in `PATH` for `set-prompt install`)
- **Windows only**: symlink creation requires Developer Mode enabled or running as Administrator (Linux/macOS work out of the box)

## Support

`set-prompt` is a solo side project. Your support genuinely makes a difference.

- Star this repo
- Report bugs — open an [issue](https://github.com/juncha9/set-prompt/issues) with steps to reproduce
- Request features — share ideas via [issues](https://github.com/juncha9/set-prompt/issues)
- Submit a PR — new agent integrations are welcome

[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=github-sponsors)](https://github.com/sponsors/juncha9)

## Dev Commands

```bash
npx tsx src/index.ts <command>   # Run without building
npm run build                    # tsup build
npm link                         # Register as global CLI
npm unlink -g set-prompt         # Remove global CLI
npm test                         # Run tests with vitest
```

## Contributing

> Contribution guidelines are still being figured out. For now, feel free to open an issue to discuss ideas or report bugs.

- Bug reports and feature requests → [GitHub Issues](https://github.com/juncha9/set-prompt/issues)
- PRs for new agent integrations are especially appreciated

## License

This project is licensed under the [MIT License](./LICENSE.md).
(c) 2026 [juncha9](https://github.com/juncha9)
