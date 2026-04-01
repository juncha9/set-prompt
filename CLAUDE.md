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

2. **Register a prompt repository** (`set-prompt install <git-url>`)
   - Git URL only — cloned to `~/.set-prompt/repo/`

3. **Link prompts to AI tools** (`set-prompt link [agent]`)
   - Reads `SKILL.md` / `COMMAND.md` from the registered repository
   - Claude Code → `~/.set-prompt/claudecode/` (Claude plugin format)
   - RooCode → `~/.roo/` (symlinks, with backup)
   - OpenClaw → (not yet implemented)

```
my-prompts/ (git repo)
  skills/, commands/, hooks/   →   set-prompt link claudecode   →   ~/.set-prompt/claudecode/
                               →   set-prompt link roocode       →   ~/.roo/
                               →   set-prompt link openclaw      →   (not yet implemented)
```

For project structure, stack, and design details, refer to [README.md](./README.md).

## Dev Commands

```bash
npx tsx src/index.ts <command>   # Run without building
npm run build                    # tsc + copy_templates
.\tests\test-cli.ps1             # Integration tests (PowerShell)
```

## Commands

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

## CLI Output Style

- **Success/failure results**: use emojis — `✅` for success, `❌` for failure
- **Command descriptions** (`index.ts`): emoji prefix + `chalk.cyan()` for key terms, `chalk.dim()` for secondary info
- **Tree output** (file/dir listings): plain `✓` / `○` with `chalk.green` / `chalk.dim` — keep compact
- **No spinners** — no long-running operations exist; use plain `console.log` instead
- **Config save**: single line — `Config saved → <path>` (no JSON dump)
- **Errors**: `chalk.red()` for message text; `❌` prefix for result-level failures

## Agent Integration Notes

### Claude Code (`link claudecode`)
1. Creates plugin structure at `~/.set-prompt/claudecode/` with symlinks into the repo
2. Modifies `~/.claude/settings.json` — adds `extraKnownMarketplaces` + `enabledPlugins` (merges, never replaces)
3. Backs up `settings.json` before writing; rolls back on failure

`claude plugin install` is NOT used — causes EPERM on Windows (symlink creation in Claude's cache).

### RooCode (`link roocode`)
1. Backs up existing `skills/`, `commands/`, `hooks/` in `~/.roo/` to `~/.roo/.set-prompt-backup/`
2. Symlinks repo dirs into `~/.roo/`
3. `uninstall` removes symlinks and restores backup

## Notes

- Files in `src/templates/` are not copied by `tsc` — always run `npm run build` after modifying templates
- Do not directly edit `dist/`
