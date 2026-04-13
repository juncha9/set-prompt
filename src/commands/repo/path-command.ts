import chalk from 'chalk';
import { configManager } from '@/_libs/config';

/**
 * Prints the installed repo path to stdout.
 * Designed for shell substitution — e.g. `cd $(sppt repo path)`.
 * Emits *only* the path on stdout (no decoration); errors go to stderr.
 */
export const repoPathCommand = (): void => {
    const repoPath = configManager.repo_path;
    if (repoPath == null) {
        console.error(chalk.red('❌ No repo installed.'));
        console.error(chalk.yellow('Run: set-prompt install <git-url>'));
        process.exitCode = 1;
        return;
    }

    console.log(repoPath);
};
