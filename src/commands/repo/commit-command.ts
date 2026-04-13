import { spawnSync } from 'child_process';
import chalk from 'chalk';
import { configManager } from '@/_libs/config';
import { generateCommitMessage } from '@/_libs/repo';

export interface RepoCommitOptions {
    /** Commit message. When omitted, auto-generated from changed filenames. */
    message?: string;
}

/**
 * Stages all changes and creates a commit. Does NOT push.
 * @returns true on success, false otherwise
 */
export const repoCommitCommand = (options: RepoCommitOptions = {}): boolean => {
    const repoPath = configManager.repo_path;
    if (repoPath == null) {
        console.error(chalk.red('❌ No repo installed.'));
        console.log(chalk.yellow('Run: set-prompt install <git-url>'));
        return false;
    }

    let message = options.message;
    if (message == null || message.trim() === '') {
        const generated = generateCommitMessage(repoPath);
        if (generated == null) {
            console.error(chalk.red('❌ Nothing to commit — working tree is clean.'));
            return false;
        }
        message = generated;
        const subject = message.split('\n')[0];
        console.log(chalk.dim(`  (auto-generated: ${subject})`));
    }

    console.log(chalk.green('\nCommitting prompt repo changes...'));
    console.log(chalk.dim(repoPath));

    const add = spawnSync('git', ['add', '-A'], { cwd: repoPath, stdio: 'inherit' });
    if (add.status !== 0) {
        console.error(chalk.red('❌ git add failed.'));
        return false;
    }

    const commit = spawnSync('git', ['commit', '-m', message], { cwd: repoPath, stdio: 'inherit' });
    if (commit.status !== 0) {
        console.error(chalk.red('❌ git commit failed — nothing to commit, or commit rejected.'));
        return false;
    }

    console.log(chalk.green('✅ Committed.'));
    return true;
};
