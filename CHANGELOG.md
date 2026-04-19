# Changelog

All notable changes to this project will be documented in this file.

---

## [0.7.0] - 2026-04-20

### Added
- OpenCode integration (`link opencode`) — dir symlinks into `~/.config/opencode/` (OpenCode's default config directory)
- `AGENT_PROMPT_DIRS[OPENCODE]` set to `['skills', 'commands', 'agents']` to match OpenCode's supported subdirectories
- `OpencodeConfigSchema` + `OpencodeConfig` type + `configManager.opencode` getter/setter + `isOpencodeEnabled()`
- `SET_PROMPT_GUIDE` template: OpenCode frontmatter reference for skills (`name`, `description`, `license`, `compatibility`, `metadata`), commands (`template` required + `agent`/`model`/`subtask`), agents (`mode`, `temperature`, `top_p`, `steps`, `tools`, `permission`, etc.)
- Tests: `tests/commands/link-opencode.test.ts`

### Changed
- `link-command.ts`: `LINK_MAP` / `UNLINK_MAP` / `prevLinked` extended with OpenCode entry

---

## [0.6.0] - 2026-04-14

### Added
- `set-prompt repo status` — VCS status: current branch, upstream + ahead/behind, colored list of changed files (separate from `set-prompt status`, which shows linked agents)
- `set-prompt repo pull` — git fetch + pull (replaces `set-prompt update`)
- `set-prompt repo commit [-m <msg>]` — stage all + commit locally; auto-generates a subject+body message when `-m` omitted (subject: `update N files`, body: bullet list of repo-relative paths)
- `set-prompt repo push` — push local commits to remote
- `set-prompt repo save [-m <msg>]` — one-step macro: commit + push (also auto-generates message)
- `set-prompt repo path` — prints the installed repo path to stdout (designed for `cd $(sppt repo path)`); errors go to stderr so piping stays clean
- `set-prompt repo open` — opens the repo in the OS file manager (`explorer` / `open` / `xdg-open`); `--code` opens in VSCode (`code` CLI), `--stree` opens in Sourcetree (auto-detects `SourceTree.exe` at `%LOCALAPPDATA%\SourceTree` on Windows where the `stree` wrapper isn't shipped)

### Changed
- `scaffold` and `install`: when the resulting working tree is dirty, print a hint guiding the user to run `sppt repo save`. Non-interactive — the user stays in control (earlier design had auto-prompted to run `save`, which risked failing pushes during `install`).
- `scaffold`: plugin manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`) are no longer overwritten when they already exist. Existing files are validated against required fields (`name` for Claude; `name` + `skills` + `mcpServers` + `apps` for Codex — the latter three are pointers Codex uses to load each integration) and preserved as-is — custom values like `version`, `description`, or non-default `name` survive re-runs. Invalid files trigger a warning but stay untouched (status: `+` created / `✓` valid / `⚠` invalid).

### Changed (Breaking)
- `set-prompt update` removed. Use `set-prompt repo pull` instead.
- Rationale: VCS-grouped commands read more clearly and leave room for future operations; `pull` is already the cross-VCS norm (Hg/JJ/Fossil all use it). `commit` and `push` stay pure git semantics; `save` is the convenience macro for the common case. `path` / `open` close the "where is my repo?" UX gap since the default install location (`~/.set-prompt/repo/`) felt distant.

### Migration
- Replace any `set-prompt update` / `sppt update` calls with `set-prompt repo pull` / `sppt repo pull`

---

## [0.5.4] - 2026-04-13

### Changed
- `SET_PROMPT_GUIDE` template: Structure section updated to include `.mcp.json`, `.app.json`, `.claude-plugin/`, `.codex-plugin/`
- Plugin manifest templates (`ensureClaudePluginManifest`, `ensureCodexPluginManifest`) — removed local repo path from `description` field to prevent leaking machine-specific paths into git history

---

## [0.5.3] - 2026-04-13

### Added
- `sppt` short alias registered as a CLI binary alongside `set-prompt` — all commands work with either name
- README: `CLI Alias` section documenting `sppt` usage

### Changed
- Repo MCP config file renamed from `mcp.json` to `.mcp.json`
- Cursor hardlink maps repo `.mcp.json` → `~/.cursor/mcp.json` (Cursor expects `mcp.json` in its config dir)

---

## [0.5.0] - 2026-04-13

### Added
- Codex integration (`link codex`) — marketplace registration, cache symlink, `config.toml` activation
- `scaffold` now generates `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.mcp.json`, `.app.json`
- `ensureClaudePluginManifest()`, `ensureCodexPluginManifest()`, `ensureMcpJson()`, `ensureAppJson()` — reusable functions for link to ensure repo has required files
- `SET_PROMPT_GUIDE.md` generation now asks for confirmation before writing
- Cursor: `.mcp.json` hardlink (`~/.cursor/mcp.json ⇔ repo/.mcp.json`) with backup/restore
- Cursor: `hooks/` directory linking added
- `templates.ts`: Cursor frontmatter (skills, agents, rules, hooks), Cursor hooks (JSON-based `hooks.json`), Codex plugin spec
- Tests split by agent: `link-claude-code.test.ts`, `link-roocode.test.ts`, `link-openclaw.test.ts`, `link-antigravity.test.ts`, `link-codex.test.ts`, `link-cursor.test.ts`

### Changed
- **Link architecture**: `scaffold` creates plugin manifests in repo, `link` symlinks repo directly (no intermediate plugin structure)
- Claude Code: marketplace `plugins/sppt` → repo symlink; `installed_plugins.json` points to repo directly
- Codex: `~/.agents/plugins/marketplace.json` + `~/.codex/plugins/cache/.../1.0.0` → repo symlink
- Cursor: reverted from plugin to dir symlinks (`~/.cursor/skills/`, `agents/`, `commands/`, `hooks/`)
- `CODEX_DIR` changed from `~/.codex` to `~/.set-prompt/codex` (no longer deletes Codex home directory on unlink)
- `scaffold`: removed `--force` option and `valid` check — always runs all steps idempotently
- All symlinks use `junction` on Windows (consistent across agents)
- All JSON output uses 4-space indentation
- `CURSOR_PLUGIN_DIR` removed from `_defs` (Cursor no longer uses plugin approach)
- `link/` source files moved from `src/commands/link/` to `src/link/`
- Uninstall tests: removed redundant per-agent unlink call assertions

### Removed
- `ensureCursorPluginManifest()` — Cursor no longer uses plugin manifests
- Cursor `rules/` from `AGENT_PROMPT_DIRS` — Cursor does not load rules from symlinked directories

---

## [0.4.0] - 2026-04-10

### Added
- Cursor integration (`link cursor`) — creates plugin structure at `~/.cursor/` with backup/restore
- `linkCommand` now shows a Link / Unlink summary before executing; exits early when there are no changes
- All `unlink*` functions print a colored header banner on start (consistent with `link*`)
- Console output: `removed` → red, `restored` → green, `backed up` → yellow
- Console output: `Config loaded` is now green (consistent with `Config saved`)

### Changed
- Claude Code plugin: `~/.claude/plugins/installed_plugins.json` is now directly patched so `installPath` points to the source plugin directory — bypasses Claude Code's cache management that was deleting the symlink on startup
- `install`: re-installing the same URL is blocked with a `set-prompt update` hint
- `install`: re-installing a different URL shows a "Switching repo" warning with confirmation (default: No)
- `install`: EPERM on directory rename is handled gracefully with a descriptive error message
- `install`: existing repo backup is automatically removed after a successful clone

### Disabled
- `link codex` is temporarily unavailable in this release (implementation preserved, re-enable in next release)

---

## [0.3.0] - 2026-04-06

### Added
- Antigravity integration (`link antigravity`) — symlinks `skills/` into `~/.gemini/antigravity/skills/` with backup/restore
- `unlinkClaudeCode`, `unlinkRooCode`, `unlinkOpenclaw`, `unlinkAntigravity` — unlink functions with force mode
- `link` command interactive mode now supports **deselection** — unchecking a linked agent triggers unlink + backup restore
- `uninstall` delegates to `unlinkXxx(true)` instead of inlining rollback logic

### Changed
- `uninstall` no longer contains rollback logic — all agent cleanup goes through `link-command.ts`
- `AntigravityConfig` schema updated to include `backup_path` (consistent with RooCode/OpenClaw)
- `AGENT_PROMPT_DIRS[ANTIGRAVITY]` set to `['skills']` only
- `scaffold` always overwrites `SET_PROMPT_GUIDE.md` — ensures the latest template on every run
- `SET_PROMPT_GUIDE.md` template updated: Antigravity frontmatter added, OpenClaw `homepage`/`user-invocable` fields added, `metadata` format corrected
- `build` script now runs `rimraf dist` before `tsup`
- README workflow restructured into 4 explicit steps

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
