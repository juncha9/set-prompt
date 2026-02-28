# set-prompt CLI — CLAUDE.md

I respect you, Claude, as a development partner and trust your abilities.
While working together, we will respect each other's roles and collaborate. Your suggestions and feedback are always welcome.

## Purpose

AI development tools like Claude Code, RooCode, and OpenClaw each have their own skill/command/hook formats.
Managing the same prompts separately for each tool leads to duplication and inconsistency.

`set-prompt` is a CLI that solves this problem:

1. **Initialize a personal git repository as a prompt repository** (`set-prompt setup`)
   - Creates `skills/`, `commands/` folder structure
   - Each skill/command is managed as a single `SKILL.md` / `COMMAND.md` file
   - Platform-specific configurations are described together in the frontmatter of each file

2. **Register a prompt repository as a source** (`set-prompt use <path|url>`)
   - Specify a local path or remote git URL
   - Remote repositories are cloned to `~/.set-prompt/cache/`

3. **Apply prompts for each AI development tool** (`set-prompt claude-code`, etc.)
   - Reads `SKILL.md` / `COMMAND.md` from the registered repository and parses frontmatter
   - Converts and deploys to the current project directory in each tool's format
   - Claude Code → `.claude/skills/`, `.claude/commands/`
   - RooCode → `.roomodes`
   - OpenClaw → OpenClaw config format

```
my-prompts/ (git repo)
  skills/my-skill/SKILL.md      →   set-prompt claude-code   →   .claude/skills/my-skill.md
  commands/my-cmd/COMMAND.md    →   set-prompt roocode        →   ~/.roo/
                                →   set-prompt openclaw       →   ~/.openclaw/*
```

For project structure, stack, and design details, refer to [README.md](./README.md).

## Dev Commands

```bash
npx tsx src/index.ts <command>   # Run without building
npm run build                    # tsc + copy_templates
```

## Commands Implementation Status

| Command | Status |
|---------|--------|
| `use` | ✅ |
| `claude-code` | ⬜ |
| `roocode` | ⬜ |
| `openclaw` | ⬜ |
| `validate` | ⬜ |

## Notes

- Files in `src/templates/` are not copied by `tsc` — always run `npm run build` after modifying templates
- Do not directly edit `dist/`
- The `install` command is an unimplemented scaffold — do not touch it
