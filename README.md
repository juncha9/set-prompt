# set-prompt

Universal prompt manager for AI coding tools. Write prompts once, apply them everywhere.

```
my-prompts/ (git repo)
    └── skills/, commands/, hooks/
            ↓ set-prompt install .
            ↓ set-prompt link claude-code
    ~/.set-prompt/claude-code/   (Claude Code plugin)
    roocode, openclaw ...        (not yet implemented)
```

## Installation

```bash
npm install -g set-prompt
# or use without installing
npx set-prompt <command>
```

## Workflow

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
└── hooks/
```

### 2. Register the repository

```bash
# remote git URL — cloned to ~/.set-prompt/repo/
set-prompt install https://github.com/you/my-prompts
```

### 3. Link to AI tools

```bash
set-prompt link              # interactive selection
set-prompt link claude-code  # Claude Code only
```

Claude Code integration creates a plugin at `~/.set-prompt/claude-code/` and registers it via the `claude` CLI.

## Commands

| Command | Description | Status |
|---------|-------------|--------|
| `scaffold [path]` | Verify and scaffold repo structure | ✅ |
| `install <url>` | Clone remote git repo and register as prompt source | ✅ |
| `link [agent]` | Link prompts to AI agents (interactive if omitted) | ✅ |
| `link claude-code` | Link to Claude Code | ✅ |
| `link roocode` | Link to RooCode | ⬜ |
| `link openclaw` | Link to OpenClaw | ⬜ |
| `status` | Show current repo and linked agents | ✅ |
| `uninstall` | Remove all set-prompt data | ✅ |

## Stack

- Node.js ESM, TypeScript
- CLI: Commander.js, Inquirer, Chalk
- Build: `tsup` + cpx for static templates
- Test: Vitest, memfs (in-memory FS mocking)

## Dev Commands

```bash
npx tsx src/index.ts <command>   # Run without building
npm run build                    # tsup + copy templates
npm test                         # Run tests with vitest
.\test-cli.ps1                   # Integration tests (PowerShell)
```

## Source Structure

```
src/
├── index.ts                      # Commander setup, banner
├── commands/
│   ├── scaffold-command.ts       # set-prompt scaffold
│   ├── install-command.ts        # set-prompt install
│   ├── link-command.ts           # set-prompt link
│   ├── status-command.ts         # set-prompt status
│   └── uninstall-command.ts      # set-prompt uninstall
├── _defs/index.ts                # constants
├── _types/index.ts               # TypeScript types + Zod schemas
├── _libs/
│   ├── config.ts                 # ConfigManager (~/.set-prompt/config.json)
│   └── index.ts                  # utility functions
└── templates/
    └── SET_PROMPT_GUIDE.md       # injected into new prompt repos
```

## Global Config

Stored at `~/.set-prompt/config.json`, managed via `ConfigManager`.

```
~/.set-prompt/
├── config.json          # repo_path, remote_url, linked agent state
├── repo/                # remote repos cloned here
│   └── <repo-name>/
│       ├── skills/
│       ├── commands/
│       └── hooks/
└── claude-code/         # Claude Code plugin output
    ├── .claude-plugin/
    │   └── marketplace.json
    └── plugins/set-prompt/
        ├── .claude-plugin/plugin.json
        ├── skills/      → symlink to repo/skills/
        ├── commands/    → symlink to repo/commands/
        └── hooks/       → symlink to repo/hooks/
```
