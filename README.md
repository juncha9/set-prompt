# set-prompt

Universal prompt manager for AI coding tools. Write prompts once, apply them everywhere.

```
my-prompts/ (git repo)
    └── skills/, commands/
            ↓ set-prompt use .
            ↓ set-prompt claude-code
    .claude/commands/,  .roomodes,  openclaw config ...
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
set-prompt init
```

Creates:

```
my-prompts/
├── set-prompt.yaml          # repository metadata
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md         # platform-specific frontmatter + prompt content
│       └── ...              # supporting files (scripts, configs, etc.)
└── commands/
    └── <command-name>/
        ├── COMMAND.md       # platform-specific frontmatter + prompt content
        └── ...              # supporting files
```

### 2. Register the source

```bash
# local repo
set-prompt use ./my-prompts

# or remote
set-prompt use https://github.com/you/my-prompts
```

Saves to `~/.set-prompt/config.yaml`. Remote repos are cloned to `~/.set-prompt/cache/`.

### 3. Apply to AI tools

Run in the project directory where you want prompts installed:

```bash
set-prompt claude-code   # → .claude/commands/, .claude/skills/
set-prompt roocode       # → .roomodes
set-prompt openclaw      # → openclaw format
```

## SKILL.md / COMMAND.md — frontmatter

Each `SKILL.md` and `COMMAND.md` uses the target platform's own frontmatter format. `set-prompt` reads the frontmatter to determine how to install the file.

See the [frontmatter reference](https://github.com/alkemic-studio/set-prompt#frontmatter-reference) in your prompt repo's README for full field details per platform.

## Commands

| Command | Description |
|---------|-------------|
| `init [path]` | Initialize a prompt repository |
| `use <source>` | Register a local path or git URL as prompt source |
| `claude-code` | Apply prompts to Claude Code in current directory |
| `roocode` | Apply prompts to RooCode in current directory |
| `openclaw` | Apply prompts to OpenClaw in current directory |
| `validate <file>` | Validate a prompt YAML against schema |

## Stack

- Node.js ESM, TypeScript (`moduleResolution: NodeNext`)
- CLI: Commander.js, Inquirer, Chalk, Ora
- Build: `tsc && npm run copy_templates` (static templates copied separately)
- Dev: `npx tsx src/index.ts <command>`

## Source Structure

```
src/
├── bin/set-prompt.ts        # bin entry (shebang)
├── index.ts                 # Commander setup, banner logic
├── commands/
│   ├── init.ts              # set-prompt init [path]
│   └── use.ts               # set-prompt use <source>
├── utils/
│   └── config.ts            # GlobalConfig, ~/.set-prompt/config.yaml
└── templates/repo/          # Copied to dist/templates/repo/ at build time
    ├── set-prompt.yaml       # {{name}}, {{version}}, {{description}}, {{author}}
    ├── README.md             # {{name}}, {{description}}
    ├── skills/.gitkeep
    └── commands/.gitkeep
```

## Global Config

Registered via `set-prompt use <source>`, stored at `~/.set-prompt/config.yaml`.

```typescript
interface GlobalConfig {
  source: string;    // original input (local path or git URL)
  localPath: string; // resolved local path (git URLs cloned to ~/.set-prompt/cache/)
  updatedAt: string;
}
```
