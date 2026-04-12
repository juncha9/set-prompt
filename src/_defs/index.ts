import path from 'path';
import os from 'os';

export const TAB = `    `;

export const MARKET_NAME = 'set-prompt';
export const PLUGIN_NAME = 'sppt';

export const HOME_DIR = path.join(os.homedir(), '.set-prompt');
export const CONFIG_PATH = path.join(HOME_DIR, 'config.json');
export const REPO_DIR = path.join(HOME_DIR, 'repo');
export const CLAUDE_CODE_DIR = path.join(HOME_DIR, 'claude-code');
export const ROO_DIR = path.join(os.homedir(), '.roo');
export const ROO_BACKUP_DIR = path.join(ROO_DIR, 'SET_PROMPT_BACKUP');
export const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw', 'workspace');
export const OPENCLAW_BACKUP_DIR = path.join(OPENCLAW_DIR, 'SET_PROMPT_BACKUP');
export const ANTIGRAVITY_DIR = path.join(os.homedir(), '.gemini', 'antigravity');
export const ANTIGRAVITY_BACKUP_DIR = path.join(ANTIGRAVITY_DIR, 'SET_PROMPT_BACKUP');
export const CODEX_DIR = path.join(HOME_DIR, 'codex');
export const CODEX_BACKUP_DIR = path.join(CODEX_DIR, 'SET_PROMPT_BACKUP');
export const CURSOR_DIR = path.join(os.homedir(), '.cursor');

export const PROMPT_DIR_NAMES = ['skills', 'commands', 'hooks', 'agents', 'rules'] as const;

export enum TOOLS {
    CLAUDECODE   = 'claudecode',
    ROOCODE      = 'roocode',
    OPENCLAW     = 'openclaw',
    CODEX        = 'codex',
    ANTIGRAVITY  = 'antigravity',
    CURSOR       = 'cursor',
}

export type AgentId = TOOLS;

export const AGENT_PROMPT_DIRS: Record<TOOLS, readonly string[]> = {
    [TOOLS.CLAUDECODE]:  ['skills', 'commands', 'hooks', 'agents'],
    [TOOLS.ROOCODE]:     ['skills', 'commands'],
    [TOOLS.OPENCLAW]:    ['skills'],
    [TOOLS.CODEX]:       ['skills'],
    [TOOLS.ANTIGRAVITY]: ['skills'],
    [TOOLS.CURSOR]:      ['skills', 'agents', 'commands', 'hooks'],
};

export const ALL_AGENTS = [
    { name: 'Claude Code',  value: TOOLS.CLAUDECODE },
    { name: 'RooCode',      value: TOOLS.ROOCODE },
    { name: 'OpenClaw',     value: TOOLS.OPENCLAW },
    { name: 'Codex',        value: TOOLS.CODEX },
    { name: 'Antigravity',  value: TOOLS.ANTIGRAVITY },
    { name: 'Cursor',       value: TOOLS.CURSOR },
] as const;