import { spawnSync } from 'child_process';
import fs from 'fs';
import chalk from 'chalk';
import { configManager } from './config';

export const isGitUrl = (source: string): boolean => (
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('git@') ||
    source.startsWith('ssh://') ||
    (source.endsWith('.git') && (source.startsWith('http') || source.startsWith('git@') || source.startsWith('ssh://')))
);

export const resolveRepoPath = (): string | null => {
    if (configManager.repo_path == null) {
        console.error(chalk.red('❌ No repo installed.'));
        console.log(chalk.yellow('Run: set-prompt install <git-url>'));
        return null;
    }
    return configManager.repo_path;
};

/** Checks whether a binary is discoverable on PATH. Uses `where` on Windows, `which` elsewhere. */
export const isOnPath = (bin: string): boolean => {
    const probeCmd = process.platform === 'win32' ? 'where' : 'which';
    const probe = spawnSync(probeCmd, [bin], { stdio: 'ignore' });
    return probe.status === 0;
};

/** Returns the first path in the list that exists on disk. Skips null/empty entries. */
export const firstExistingPath = (candidates: (string | undefined | null)[]): string | null => {
    for (const candidate of candidates) {
        if (candidate != null && candidate !== '' && fs.existsSync(candidate)) return candidate;
    }
    return null;
};
