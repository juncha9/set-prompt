# Set Prompt Repository Guide

> Managed by [set-prompt](https://github.com/alkemic-studio/set-prompt)

## Structure

```
├── set-prompt.yaml        # Repository configuration
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md       # Platform-specific frontmatter + prompt content
│       └── ...            # Supporting files (scripts, configs, etc.)
└── commands/
    └── <command-name>/
        ├── COMMAND.md     # Platform-specific frontmatter + prompt content
        └── ...            # Supporting files
```

## Frontmatter Reference

### Skills

Auto-loadable AI behaviors.

```yaml
---
# Common
name: "my-skill"
description: "What this skill does and when to use it"

# Claude Code
allowed-tools:
  - Read
  - Bash
disable-model-invocation: false
model: sonnet
context: fork
agent: general-purpose
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: ".claude/hooks/validate.sh"

# RooCode
slug: my-mode
name: "🔧 My Mode"
roleDefinition: "You are a specialist in..."
groups:
  - read
  - edit
  - command
whenToUse: "Use when you need to..."
customInstructions: "Additional behavior guidelines..."

# OpenClaw
homepage: "https://github.com/you/my-skill"
metadata: {"openclaw":{"emoji":"🔧","os":["darwin","linux"]}}
---
```

| Field | Required | Platform | Description |
|-------|----------|----------|-------------|
| `name` | Yes | All | Display name. Claude Code: lowercase, numbers, hyphens only (max 64 chars). RooCode: emoji allowed. |
| `description` | Yes | All | What it does and when to use it. Claude uses this to decide auto-loading. |
| `disable-model-invocation` | No | CC, OpenClaw | `true` = prevent auto-loading, manual `/name` only. (default: `false`) |
| `allowed-tools` | No | Claude Code | Tools Claude can use without asking. e.g. `Read` `Write` `Edit` `Bash` `Grep` `Glob` |
| `model` | No | Claude Code | Model to use when active. `sonnet` or `haiku` |
| `context` | No | Claude Code | `fork` = run in a forked subagent context |
| `agent` | No | Claude Code | Subagent type when `context: fork`. e.g. `general-purpose` `Explore` `Plan` |
| `hooks` | No | Claude Code | Lifecycle hooks for pre/post processing. |
| `slug` | Yes | RooCode | Unique ID — `[a-zA-Z0-9-]` only |
| `roleDefinition` | Yes | RooCode | Core role and expertise definition |
| `groups` | Yes | RooCode | Tool permissions: `read` `edit` `command` `mcp` `browser` |
| `whenToUse` | No | RooCode | Guide for auto mode selection |
| `customInstructions` | No | RooCode | Additional behavior guidelines |
| `homepage` | No | OpenClaw | Website URL shown in the Skills UI |
| `metadata` | No | OpenClaw | Single-line JSON for platform gating. e.g. `os`, `requires.bins`, `requires.env` |

RooCode file-restricted edit example:
```yaml
groups:
  - read
  - [edit, {fileRegex: '\.(md|ts)$', description: "Markdown and TS only"}]
```

---

### Commands

User-invocable slash commands (`/command-name`).

> RooCode does not have a separate command concept — use **Skills (modes)** instead.

```yaml
---
# Common
name: "my-command"
description: "What this command does"

# Claude Code
allowed-tools:
  - Read
  - Bash
argument-hint: "[filename] [format]"
user-invocable: true
model: sonnet
context: fork
agent: general-purpose
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "npm run lint"
          async: true

# OpenClaw
user-invocable: true
command-dispatch: "tool"   # bypass model, dispatch directly to a tool
command-tool: "Bash"
---
```

| Field | Required | Platform | Description |
|-------|----------|----------|-------------|
| `name` | No | All | Display name — lowercase, numbers, hyphens only (max 64 chars). Defaults to directory name. |
| `description` | Yes | All | Shown in `/` menu. Claude uses this to decide auto-loading. |
| `user-invocable` | No | CC, OpenClaw | `false` = hidden from `/` menu, background knowledge only. (default: `true`) |
| `allowed-tools` | No | Claude Code | Tools Claude can use without asking. e.g. `Read` `Write` `Edit` `Bash` `Grep` `Glob` |
| `argument-hint` | No | Claude Code | Hint shown during autocomplete. e.g. `[issue-number]` |
| `model` | No | Claude Code | Model to use when active. `sonnet` or `haiku` |
| `context` | No | Claude Code | `fork` = run in a forked subagent context |
| `agent` | No | Claude Code | Subagent type when `context: fork`. e.g. `general-purpose` `Explore` `Plan` |
| `hooks` | No | Claude Code | Lifecycle hooks for pre/post processing. |
| `command-dispatch` | No | OpenClaw | `"tool"` = bypass model, dispatch directly to a tool |
| `command-tool` | No | OpenClaw | Tool to invoke when `command-dispatch: "tool"` |
| `command-arg-mode` | No | OpenClaw | How arguments are forwarded to the tool. (default: `"raw"`) |

---

### Hooks

Lifecycle shell commands (or LLM prompts) that fire at specific points. Hooks in skill/command frontmatter are scoped to that component — active while it runs, removed when it finishes.

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"          # regex matched against tool name
      hooks:
        - type: command
          command: ".claude/hooks/validate.sh"
          timeout: 30          # seconds (default: 600)
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "npm run lint"
          async: true          # run in background, non-blocking
  Stop:
    - hooks:
        - type: prompt
          prompt: "Verify all tasks are complete: $ARGUMENTS"
```

**Events**

| Event | Matcher | Can Block | When it fires |
|-------|---------|:---------:|---------------|
| `PreToolUse` | tool name | Yes | Before a tool runs |
| `PostToolUse` | tool name | No | After a tool succeeds |
| `PostToolUseFailure` | tool name | No | After a tool fails |
| `UserPromptSubmit` | — | Yes | When user submits a prompt |
| `SessionStart` | `startup` \| `resume` \| `clear` \| `compact` | No | Session begins |
| `Stop` | — | Yes | Claude finishes responding |
| `Notification` | `permission_prompt` \| `idle_prompt` | No | Notification fires |
| `SubagentStart` / `SubagentStop` | agent type | No / Yes | Subagent spawned / finished |

Full event list: [hooks reference](https://code.claude.com/docs/en/hooks)

**Handler fields**

| Field | Type | Description |
|-------|------|-------------|
| `type` | required | `command`, `prompt`, or `agent` |
| `command` | command only | Shell command to execute. Receives hook JSON on stdin |
| `prompt` | prompt/agent | Prompt text. Use `$ARGUMENTS` for the hook JSON input |
| `timeout` | all | Seconds before cancel. Defaults: 600 / 30 / 60 |
| `async` | command only | `true` = run in background, cannot block Claude |
| `once` | command only | `true` = run once per session then remove (skills only) |

**Decision control** (command hooks)

Exit `0` = allow. Exit `2` = block (stderr is fed to Claude as the reason). Print JSON to stdout for richer control:

```bash
# PreToolUse: deny via JSON
echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"reason"}}'

# Stop/PostToolUse: block via JSON
echo '{"decision":"block","reason":"Tests must pass first"}'
```

## Usage

```bash
# Register this repo as prompt source
set-prompt use .

# Validate prompt definitions
set-prompt validate skills/example/SKILL.md
```
