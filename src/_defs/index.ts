import path from 'path';
import os from 'os';

export const TAB = `    `;

export const HOME_DIR = path.join(os.homedir(), '.set-prompt');
export const CONFIG_PATH = path.join(HOME_DIR, 'config.json');
export const REPO_DIR = path.join(HOME_DIR, 'repo');
export const CLAUDE_CODE_DIR = path.join(HOME_DIR, 'claude-code');
export const ROO_DIR = path.join(os.homedir(), '.roo');
export const ROO_BACKUP_DIR = path.join(ROO_DIR, '.set-prompt-backup');

export const REPO_CONFIG_FILENAME = 'set-prompt.toml';
export const PROMPT_DIR_NAMES = ['skills', 'commands', 'hooks'] as const;

export enum TOOLS {
    CLAUDECODE   = 'claudecode',
    ROOCODE      = 'roocode',
    OPENCLAW     = 'openclaw',
    CODEX        = 'codex',
    ANTIGRAVITY  = 'antigravity',
}

export type AgentId = TOOLS;

export const ALL_AGENTS = [
    { name: 'Claude Code',  value: TOOLS.CLAUDECODE },
    { name: 'RooCode',      value: TOOLS.ROOCODE },
    { name: 'OpenClaw',     value: TOOLS.OPENCLAW },
    { name: 'Codex',        value: TOOLS.CODEX },
    { name: 'Antigravity',  value: TOOLS.ANTIGRAVITY },
] as const;