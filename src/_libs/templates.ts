export const SET_PROMPT_GUIDE = `# Set Prompt Repository Guide

> Managed by [set-prompt](https://github.com/juncha9/set-prompt)

This is a shared prompt repository linked to various AI agents via \`set-prompt link\`. When writing or editing prompts in this repository, refer to the structure below and the frontmatter reference for each platform's conventions.

## Structure

\`\`\`
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md       # Platform-specific frontmatter + prompt content
│       └── ...            # Supporting files (scripts, configs, etc.)
├── commands/
│   └── <command-name>/
│       ├── COMMAND.md     # Platform-specific frontmatter + prompt content
│       └── ...            # Supporting files
├── hooks/                 # Lifecycle shell hooks (Claude Code)
├── agents/                # Agent definitions (Claude Code, Cursor)
│   └── <agent-name>/
│       └── AGENT.md
├── rules/                 # Rule definitions (Cursor)
│   └── <rule-name>/
│       └── RULE.md
├── .mcp.json              # MCP server configurations
├── .app.json              # Application configurations
├── .claude-plugin/
│   └── plugin.json        # Claude Code plugin manifest
└── .codex-plugin/
    └── plugin.json        # Codex plugin manifest
\`\`\`

## Usage

\`\`\`bash
# Scaffold this repo's directory structure
set-prompt scaffold .

# Install from remote and link to AI tools
set-prompt install https://github.com/you/my-prompts
set-prompt link

# Inspect current state (branch, ahead/behind, changed files)
set-prompt repo status

# Pull latest changes from remote
set-prompt repo pull

# Commit + push local edits in one step (auto-generates message if -m omitted)
set-prompt repo save -m "update skills"
set-prompt repo save

# Or commit and push separately
set-prompt repo commit -m "update skills"
set-prompt repo push

# Jump into the repo or open it in an editor
cd "$(set-prompt repo path)"
set-prompt repo open --code
\`\`\`

## Frontmatter Reference

### Skills

Auto-loadable AI behaviors.

\`\`\`yaml
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
user-invocable: true
disable-model-invocation: false
metadata: {"os":["darwin","linux"],"requires":{"bins":["git"],"env":["MY_API_KEY"]}}

# Antigravity
name: my-skill
description: "What this skill does and when to use it"

# Cursor
name: "my-skill"
description: "What this skill does and when to use it"
license: "MIT"
compatibility: "Requires Node.js 18+"
metadata:
  category: "development"
disable-model-invocation: false
---
\`\`\`

| Field | Required | Platform | Description |
|-------|----------|----------|-------------|
| \`name\` | Yes | All | Display name. Claude Code: lowercase, numbers, hyphens only (max 64 chars). RooCode: emoji allowed. Antigravity: optional, defaults to folder name. |
| \`description\` | Yes | All | What it does and when to use it. Claude uses this to decide auto-loading. |
| \`allowed-tools\` | No | Claude Code | Tools Claude can use without asking. e.g. \`Read\` \`Write\` \`Edit\` \`Bash\` \`Grep\` \`Glob\` |
| \`model\` | No | Claude Code | Model to use when active. \`sonnet\` or \`haiku\` |
| \`context\` | No | Claude Code | \`fork\` = run in a forked subagent context |
| \`agent\` | No | Claude Code | Subagent type when \`context: fork\`. e.g. \`general-purpose\` \`Explore\` \`Plan\` |
| \`hooks\` | No | Claude Code | Lifecycle hooks for pre/post processing. |
| \`slug\` | Yes | RooCode | Unique ID — \`[a-zA-Z0-9-]\` only |
| \`roleDefinition\` | Yes | RooCode | Core role and expertise definition |
| \`groups\` | Yes | RooCode | Tool permissions: \`read\` \`edit\` \`command\` \`mcp\` \`browser\` |
| \`whenToUse\` | No | RooCode | Guide for auto mode selection |
| \`customInstructions\` | No | RooCode | Additional behavior guidelines |
| \`groups\` (restricted) | No | RooCode | Restrict edit to file patterns: \`[edit, {fileRegex: '\\.(md|ts)$', description: "..."}]\` |
| \`metadata\` | No | OpenClaw | Single-line JSON for platform gating: \`os\` (platform filter), \`requires.bins\` (required binaries), \`requires.env\` (required env vars) |
| \`homepage\` | No | OpenClaw | URL shown as "Website" in the macOS Skills UI. Also settable via \`metadata.openclaw.homepage\`. |
| \`user-invocable\` | No | OpenClaw | \`false\` = hidden from \`/\` menu. (default: \`true\`) |
| \`disable-model-invocation\` | No | Claude Code, OpenClaw, Cursor | \`true\` = skill only included when explicitly invoked via \`/skill-name\`. (default: \`false\`) |
| \`command-dispatch\` | No | OpenClaw | \`"tool"\` = bypass model, dispatch directly to a tool |
| \`command-tool\` | No | OpenClaw | Tool to invoke when \`command-dispatch: "tool"\` |
| \`command-arg-mode\` | No | OpenClaw | How arguments are forwarded to the tool. (default: \`"raw"\`) |
| \`license\` | No | Cursor | License name or reference to a bundled license file. |
| \`compatibility\` | No | Cursor | Environment requirements (system packages, network access, etc.) |
| \`metadata\` | No | Cursor | Arbitrary key-value mapping for additional metadata. |

---

### Commands

User-invocable slash commands (\`/command-name\`).

> RooCode does not have a separate command concept — use **Skills (modes)** instead.

\`\`\`yaml
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
\`\`\`

| Field | Required | Platform | Description |
|-------|----------|----------|-------------|
| \`name\` | No | All | Display name — lowercase, numbers, hyphens only (max 64 chars). Defaults to directory name. |
| \`description\` | Yes | All | Shown in \`/\` menu. Claude uses this to decide auto-loading. |
| \`user-invocable\` | No | Claude Code, OpenClaw | \`false\` = hidden from \`/\` menu, background knowledge only. (default: \`true\`) |
| \`allowed-tools\` | No | Claude Code | Tools Claude can use without asking. e.g. \`Read\` \`Write\` \`Edit\` \`Bash\` \`Grep\` \`Glob\` |
| \`argument-hint\` | No | Claude Code | Hint shown during autocomplete. e.g. \`[issue-number]\` |
| \`model\` | No | Claude Code | Model to use when active. \`sonnet\` or \`haiku\` |
| \`context\` | No | Claude Code | \`fork\` = run in a forked subagent context |
| \`agent\` | No | Claude Code | Subagent type when \`context: fork\`. e.g. \`general-purpose\` \`Explore\` \`Plan\` |
| \`hooks\` | No | Claude Code | Lifecycle hooks for pre/post processing. |

---

### Agents

Custom subagent definitions loaded by Claude Code and Cursor.

\`\`\`yaml
---
# Claude Code
name: "my-agent"
description: "What this agent does and when to use it"
allowed-tools:
  - Read
  - Bash
model: sonnet
context: fork

# Cursor
name: "my-agent"
description: "What this agent does and when to use it"
model: inherit
readonly: false
is_background: false
---
\`\`\`

| Field | Required | Platform | Description |
|-------|----------|----------|-------------|
| \`name\` | Yes | All | Display name. Claude Code: lowercase, numbers, hyphens only (max 64 chars). Cursor: defaults to folder name. |
| \`description\` | Yes | All | When and how to use this agent. Used to decide when to spawn/delegate. |
| \`allowed-tools\` | No | Claude Code | Tools this agent can use without asking |
| \`model\` | No | All | Claude Code: \`sonnet\` or \`haiku\`. Cursor: \`fast\`, \`inherit\`, or a specific model ID. |
| \`context\` | No | Claude Code | \`fork\` = run in isolated subagent context |
| \`readonly\` | No | Cursor | \`true\` = sub-agent runs with restricted write permissions (no file edits or state-changing shell commands). (default: \`false\`) |
| \`is_background\` | No | Cursor | \`true\` = sub-agent runs in background without blocking parent. (default: \`false\`) |

---

### Rules

System-level instructions for the AI agent. Cursor only. Rules are markdown files (\`.md\` or \`.mdc\`) stored in \`.cursor/rules/\`. When a rule is active, its content is prepended to the model context.

\`\`\`yaml
---
description: "When and how this rule should be applied"
globs:
  - "**/*.ts"
  - "**/*.tsx"
alwaysApply: false
---

Use \`@filename\` to reference files instead of copying content.
\`\`\`

**Activation Types**

| Type | \`alwaysApply\` | \`globs\` | \`description\` | Behavior |
|------|:-----------:|:-----:|:-----------:|----------|
| Always | \`true\` | ignored | optional | Included in every conversation |
| Auto Attached | \`false\` | set | optional | Included when open files match glob patterns |
| Agent Requested | \`false\` | empty | set | AI decides based on description relevance |
| Manual | \`false\` | empty | empty | Invoked via \`@rule-name\` mention only |

| Field | Required | Description |
|-------|----------|-------------|
| \`description\` | No | Describes the rule's purpose. Used by AI to decide relevance (Agent Requested type). |
| \`globs\` | No | File patterns for auto-attachment. e.g. \`["**/*.ts", "src/components/**"]\` |
| \`alwaysApply\` | No | \`true\` = always included regardless of context. (default: \`false\`) |

**Priority**: Team Rules > Project Rules (\`.cursor/rules/\`) > User Rules (Cursor Settings) > \`AGENTS.md\`

**Best practices**: Keep rules under 500 lines. Reference files with \`@filename\` instead of copying. Be specific — avoid duplicating what linters or the agent already knows.

---

### Hooks

Lifecycle scripts that fire at specific points in the agent loop. Both Claude Code and Cursor support hooks, but with different configuration formats and event models.

#### Claude Code Hooks

Defined in YAML frontmatter within skill/command files. Scoped to that component — active while it runs, removed when it finishes.

\`\`\`yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: ".claude/hooks/validate.sh"
          timeout: 30
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "npm run lint"
          async: true
  Stop:
    - hooks:
        - type: prompt
          prompt: "Verify all tasks are complete: $ARGUMENTS"
\`\`\`

**Events**

| Event | Matcher | Can Block | When it fires |
|-------|---------|:---------:|---------------|
| \`PreToolUse\` | tool name | Yes | Before a tool runs |
| \`PostToolUse\` | tool name | No | After a tool succeeds |
| \`PostToolUseFailure\` | tool name | No | After a tool fails |
| \`UserPromptSubmit\` | — | Yes | When user submits a prompt |
| \`SessionStart\` | \`startup\` \\| \`resume\` \\| \`clear\` \\| \`compact\` | No | Session begins |
| \`Stop\` | — | Yes | Agent finishes responding |
| \`Notification\` | \`permission_prompt\` \\| \`idle_prompt\` | No | Notification fires |
| \`SubagentStart\` / \`SubagentStop\` | agent type | No / Yes | Subagent spawned / finished |

**Handler fields**

| Field | Type | Description |
|-------|------|-------------|
| \`type\` | required | \`command\`, \`prompt\`, or \`agent\` |
| \`command\` | command only | Shell command to execute. Receives hook JSON on stdin |
| \`prompt\` | prompt/agent | Prompt text. Use \`$ARGUMENTS\` for the hook JSON input |
| \`timeout\` | all | Seconds before cancel. Defaults: 600 / 30 / 60 |
| \`async\` | command only | \`true\` = run in background, cannot block |
| \`once\` | command only | \`true\` = run once per session then remove (skills only) |

Full event list: [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)

---

#### Cursor Hooks

Defined in \`hooks.json\` — not in frontmatter. Project-level (\`.cursor/hooks.json\`) or user-level (\`~/.cursor/hooks.json\`). Supports both command-based and prompt-based (LLM evaluation) handlers.

\`\`\`json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [{ "command": ".cursor/hooks/format.sh" }],
    "beforeShellExecution": [
      { "command": ".cursor/hooks/approve.sh", "matcher": "curl|wget", "timeout": 30 }
    ],
    "stop": [{ "command": ".cursor/hooks/audit.sh", "loop_limit": 10 }],
    "beforeReadFile": [{ "command": ".cursor/hooks/redact.sh", "failClosed": true }],
    "preToolUse": [
      { "type": "prompt", "prompt": "Is this tool call safe?", "matcher": "Shell" }
    ]
  }
}
\`\`\`

**Agent Events**

| Event | Matcher | Can Block | When it fires |
|-------|---------|:---------:|---------------|
| \`sessionStart\` | — | No | New conversation created |
| \`sessionEnd\` | — | No | Conversation ends |
| \`preToolUse\` | tool type | Yes | Before any tool runs |
| \`postToolUse\` | tool type | No | After a tool succeeds |
| \`postToolUseFailure\` | tool type | No | After a tool fails/times out |
| \`subagentStart\` | agent type | Yes | Before sub-agent spawns |
| \`subagentStop\` | agent type | Yes\\* | Sub-agent completes (\\*followup_message) |
| \`beforeShellExecution\` | command text | Yes | Before shell command runs |
| \`afterShellExecution\` | — | No | After shell command completes |
| \`beforeMCPExecution\` | — | Yes | Before MCP tool runs |
| \`afterMCPExecution\` | — | No | After MCP tool completes |
| \`beforeReadFile\` | tool type | Yes | Before file read |
| \`afterFileEdit\` | tool type | No | After file is edited |
| \`beforeSubmitPrompt\` | — | Yes | Before prompt sent to backend |
| \`preCompact\` | — | No | Before context compaction (observe only) |
| \`stop\` | — | Yes\\* | Agent loop ends (\\*followup_message) |
| \`afterAgentResponse\` | — | No | After assistant message |
| \`afterAgentThought\` | — | No | After thinking block |

**Tab Events** (inline autocomplete only)

| Event | When it fires |
|-------|---------------|
| \`beforeTabFileRead\` | Before Tab reads a file |
| \`afterTabFileEdit\` | After Tab edits a file |

**Handler fields**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| \`command\` | string | required | Script path or shell command |
| \`type\` | string | \`"command"\` | \`"command"\` or \`"prompt"\` (LLM evaluation) |
| \`timeout\` | number | platform default | Execution timeout in seconds |
| \`matcher\` | string | — | Regex filter for when the hook fires |
| \`loop_limit\` | number\\|null | \`5\` | Max auto-followups for stop/subagentStop. \`null\` = unlimited |
| \`failClosed\` | boolean | \`false\` | \`true\` = block on hook failure instead of fail-open |

Full event list: [Cursor hooks reference](https://cursor.com/docs/hooks)

---

**Decision control** (both platforms)

Exit \`0\` = allow. Exit \`2\` = block. Claude Code reads stderr as the reason. Cursor uses JSON stdout:

\`\`\`bash
# Claude Code: deny via JSON
echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"reason"}}'

# Cursor: deny via JSON
echo '{"permission":"deny","user_message":"Blocked by policy","agent_message":"Not allowed"}'
\`\`\`

`;
