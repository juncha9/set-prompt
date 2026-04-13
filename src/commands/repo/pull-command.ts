import { spawnSync } from 'child_process';
import chalk from 'chalk';
import { configManager } from '@/_libs/config';

export const repoPullCommand = (): void => {
    const repoPath = configManager.repo_path;
    if (repoPath == null) {
        console.error(chalk.red('❌ No repo installed.'));
        console.log(chalk.yellow('Run: set-prompt install <git-url>'));
        return;
    }

    if (configManager.remote_url == null) {
        console.error(chalk.red('❌ No remote URL registered. Cannot pull.'));
        return;
    }

    console.log(chalk.green('\nPulling prompt repo...'));
    console.log(chalk.dim(repoPath));

    const fetch = spawnSync('git', ['fetch'], { cwd: repoPath, stdio: 'inherit' });
    if (fetch.status !== 0) {
        console.error(chalk.red('❌ git fetch failed.'));
        return;
    }

    const pull = spawnSync('git', ['pull'], { cwd: repoPath, stdio: 'inherit' });
    if (pull.status !== 0) {
        console.error(chalk.red('❌ git pull failed.'));
        return;
    }

    console.log(chalk.green('✅ Repo pulled.'));
};
