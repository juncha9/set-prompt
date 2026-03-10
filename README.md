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
├── SEET_PROMPT_GUIDE.md   # This file (instructions for using the repo)
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
- Build: `tsup` + cpx for static templates
- Test: Vitest, `@vitest/coverage-v8`, memfs (in-memory FS mocking)
- Dev: `npx tsx src/index.ts <command>`

## Dev Commands

```bash
npx tsx src/index.ts <command>   # Run without building
npm run build                    # tsup + copy bin/templates
npm test                         # Run tests with vitest
npm test -- --coverage           # Run tests with coverage report
```

## Source Structure

```
src/
├── bin/set-prompt.js        # bin entry (shebang)
├── index.ts                 # Commander setup, banner logic
├── commands/
│   ├── apply-command.ts     # logic for applying prompts to AI tools
│   ├── setup-command.ts     # logic for `set-prompt use` (registering sources)
│   └── validate-command.ts  # logic for `set-prompt validate`
├── _defs/
│   └── index.ts             # constants and definitions
├── _types/
│   └── index.ts             # shared TypeScript types
├── _libs/
│   ├── config.ts            # GlobalConfig read/write (~/.set-prompt/config.toml)
│   └── index.ts             # common utility functions
└── templates/               # Copied to dist/templates/ at build time
    └── SET_PROMPT_GUIDE.md  # template injected into new prompt repos
```

## Global Config

Registered via `set-prompt use <source>`, stored at `~/.set-prompt/config.toml`.

```
~/.set-prompt/
├── config.toml         # global config (remote_url, repo_path)
└── repo/               # remote repos cloned here
    └── <repo-name>/     # e.g. my-prompts
        ├── skills/
        └── commands/
```

```typescript
interface GlobalConfig {
  remote_url: string;    // original URL (git URL or local path)
  repo_path: string; // local path where repo is located (same as remote_url if local, or ~/.set-prompt/repo/<repo-name> if remote)
}
```
