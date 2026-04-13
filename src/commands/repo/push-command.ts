import { spawnSync } from 'child_process';
import chalk from 'chalk';
import { configManager } from '@/_libs/config';

/**
 * Pushes local commits to the remote.
 * @returns true on success, false otherwise
 */
export const repoPushCommand = (): boolean => {
    const repoPath = configManager.repo_path;
    if (repoPath == null) {
        console.error(chalk.red('❌ No repo installed.'));
        console.log(chalk.yellow('Run: set-prompt install <git-url>'));
        return false;
    }

    if (configManager.remote_url == null) {
        console.error(chalk.red('❌ No remote URL registered. Cannot push.'));
        return false;
    }

    console.log(chalk.green('\nPushing prompt repo...'));
    console.log(chalk.dim(repoPath));

    const push = spawnSync('git', ['push'], { cwd: repoPath, stdio: 'inherit' });
    if (push.status !== 0) {
        console.error(chalk.red('❌ git push failed.'));
        return false;
    }

    console.log(chalk.green('✅ Pushed.'));
    return true;
};
