# Changelog

All notable changes to this project will be documented in this file.

---

## [0.2.1] - 2026-04-02

### Changed
- Add `repository`, `homepage`, `bugs` fields to `package.json` for npm registry links
- Update package description to "Sync your prompt library across AI coding tools from a single git repo"

---

## [0.2.0] - 2026-04-02

### Added
- `update` command — `git fetch` + `git pull` on the registered repo
- `agents/` directory to scaffold structure (optional, Claude Code only)
- Agents frontmatter section in `SET_PROMPT_GUIDE` template
- `AGENT_PROMPT_DIRS` map — per-agent directory control (claudecode: all, roocode: skills+commands, openclaw: skills only)
- OpenClaw integration (`link openclaw`) — symlinks `skills/` into `~/.openclaw/workspace/`
- Backup/restore for OpenClaw (`SET_PROMPT_BACKUP/`)

### Changed
- Backup folder renamed from `.set-prompt-backup` → `SET_PROMPT_BACKUP`
- `SET_PROMPT_GUIDE` template: `set-prompt.yaml` → `set-prompt.toml`, updated structure and usage
- `vitest` reporter set to `--reporter=verbose`
- `.npmignore`: added `tests/`, fixed `CLAUDE.md` entry, removed redundant entries

### Fixed
- `link roocode` no longer symlinks `hooks/` (RooCode does not support it)

---

## [0.1.0] - 2026-03

### Added
- RooCode integration (`link roocode`) — symlinks into `~/.roo/` with backup/restore
- Codex and Antigravity stubs
- `status` command
- `uninstall` command with rollback support for Claude Code and RooCode
- `vitest` test infrastructure with `memfs`
- Cross-platform symlink support (Windows junction)

### Changed
- Config format migrated from TOML to JSON (`~/.set-prompt/config.json`)
- CLI refactored to `commander` with subcommands
- Build system migrated to `tsup`
- `ConfigManager` class introduced for typed config management

---

## [0.0.1] - 2026-03

### Added
- Initial project setup (TypeScript + Commander)
- `scaffold` command
- `install` command — clone remote git repo into `~/.set-prompt/repo/`
- `link claudecode` — Claude Code plugin structure at `~/.set-prompt/claudecode/`
