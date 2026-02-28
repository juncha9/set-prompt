import path from 'path';
import os from 'os';

export const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.set-prompt');
export const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'config.toml');

export const REPO_CONFIG_FILENAME = 'set-prompt.toml';
