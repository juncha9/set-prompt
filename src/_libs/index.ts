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
