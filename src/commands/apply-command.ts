import path from 'path';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { copy, pathExists } from 'fs-extra';
import { CLAUDE_CODE_DIR } from '@/_defs';

const spinner = ora();

export const applyClaudeCode = async (repoPath: string): Promise<void> => {
    const dirs = ['skills', 'commands', 'hooks'];

    for (const dir of dirs) {
        const src = path.join(repoPath, dir);
        const dest = path.join(CLAUDE_CODE_DIR, dir);
        if (await pathExists(src)) {
            await copy(src, dest, { overwrite: true });
        }
    }

    console.log(chalk.green(`\nPlugin built: ${chalk.dim(CLAUDE_CODE_DIR)}`));

    const doInstall = await confirm({
        message: 'Run "claude plugin install" now?',
        default: true,
    });

    if (doInstall) {
        spinner.start('Installing plugin...');
        const result = spawnSync('claude', ['plugin', 'install', CLAUDE_CODE_DIR], { stdio: 'pipe' });
        if (result.status !== 0) {
            spinner.fail('Plugin install failed.');
            console.error(chalk.red(result.stderr?.toString() ?? 'Unknown error'));
        } else {
            spinner.succeed('Plugin installed.');
        }
    } else {
        console.log(chalk.dim(`\nRun manually: claude plugin install ${CLAUDE_CODE_DIR}`));
    }
};

export const applyRoocode = async (_repoPath: string): Promise<void> => {
    console.log(chalk.yellow('RooCode integration is not yet implemented.'));
};

export const applyOpenclaw = async (_repoPath: string): Promise<void> => {
    console.log(chalk.yellow('OpenClaw integration is not yet implemented.'));
};
