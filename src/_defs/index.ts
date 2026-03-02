import path from 'path';
import os from 'os';

export const TAB = `    `;

export const HOME_DIR = path.join(os.homedir(), '.set-prompt');
export const CONFIG_PATH = path.join(HOME_DIR, 'config.toml');
export const REPO_DIR = path.join(HOME_DIR, 'repo');
export const CLAUDE_CODE_DIR = path.join(HOME_DIR, 'claude-code');

export const REPO_CONFIG_FILENAME = 'set-prompt.toml';
