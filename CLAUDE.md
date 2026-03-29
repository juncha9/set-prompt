# set-prompt CLI — CLAUDE.md

I respect you, Claude, as a development partner and trust your abilities.
While working together, we will respect each other's roles and collaborate. Your suggestions and feedback are always welcome.

## Purpose

AI development tools like Claude Code, RooCode, and OpenClaw each have their own skill/command/hook formats.
Managing the same prompts separately for each tool leads to duplication and inconsistency.

`set-prompt` is a CLI that solves this problem:

1. **Initialize a prompt repository** (`set-prompt scaffold <path>`)
   - Creates `skills/`, `commands/`, `hooks/` folder structure
   - Each skill/command is managed as a single `SKILL.md` / `COMMAND.md` file

2. **Register a prompt repository** (`set-prompt install <path|url>`)
   - Specify a local path or remote git URL
   - Remote repositories are cloned to `~/.set-prompt/repo/`

3. **Link prompts to AI tools** (`set-prompt link [agent]`)
   - Reads `SKILL.md` / `COMMAND.md` from the registered repository
   - Claude Code → `~/.set-prompt/claude-code/` (Claude plugin format)
   - RooCode → (not yet implemented)
   - OpenClaw → (not yet implemented)

```
my-prompts/ (git repo)
  skills/my-skill/SKILL.md      →   set-prompt link claude-code   →   ~/.set-prompt/claude-code/
  commands/my-cmd/COMMAND.md    →   set-prompt link roocode        →   (not yet implemented)
                                →   set-prompt link openclaw       →   (not yet implemented)
```

For project structure, stack, and design details, refer to [README.md](./README.md).

## Dev Commands

```bash
npx tsx src/index.ts <command>   # Run without building
npm run build                    # tsc + copy_templates
.\test-cli.ps1                   # Integration tests (PowerShell)
```

## Commands

| Command | Description | Status |
|---------|-------------|--------|
| `scaffold [path]` | Verify and scaffold repo structure | ✅ |
| `install <source>` | Register prompt repo (local path or remote git URL) | ✅ |
| `link [agent]` | Link prompts to AI agents (interactive if omitted) | ✅ |
| `link claude-code` | Link to Claude Code | ✅ |
| `link roocode` | Link to RooCode | ⬜ |
| `link openclaw` | Link to OpenClaw | ⬜ |
| `status` | Show current repo and linked agents | ✅ |
| `uninstall` | Remove all set-prompt data | ✅ |

## CLI Output Style

- **Success/failure results**: use emojis — `✅` for success, `❌` for failure
- **Command descriptions** (`index.ts`): emoji prefix + `chalk.cyan()` for key terms, `chalk.dim()` for secondary info
- **Tree output** (file/dir listings): plain `✓` / `○` with `chalk.green` / `chalk.dim` — keep compact
- **No spinners** — no long-running operations exist; use plain `console.log` instead
- **Config save**: single line — `Config saved → <path>` (no JSON dump)
- **Errors**: `chalk.red()` for message text; `❌` prefix for result-level failures

## Claude Code Integration

`link claude-code` does the following:
1. Creates plugin structure at `~/.set-prompt/claude-code/` with symlinks into the repo
2. Runs `claude plugin marketplace add <dir>` to register the marketplace via CLI
3. Adds `enabledPlugins` entry directly to `~/.claude/settings.json` (boolean flag only — safe)
4. Saves `claude_code.path` to set-prompt config

`claude plugin install` is NOT used — it causes EPERM on Windows due to symlink creation in its cache.

## Notes

- Files in `src/templates/` are not copied by `tsc` — always run `npm run build` after modifying templates
- Do not directly edit `dist/`
