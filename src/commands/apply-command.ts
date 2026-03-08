import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { pathExists } from 'fs-extra';
import { CLAUDE_CODE_DIR } from '@/_defs';
import { getConfig } from '@/_libs/config';

const spinner = ora();

const resolveRepoPath = (): string | null => {
    const config = getConfig();
    if (!config) {
        console.error(chalk.red('No prompt source registered.'));
        console.log(chalk.yellow('Run: set-prompt use <local-path or git-url>'));
        return null;
    }
    return config.repo_path;
};

export const applyClaudeCode = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (!repoPath) return;

    const dirs = ['skills', 'commands', 'hooks'];

    fs.mkdirSync(CLAUDE_CODE_DIR, { recursive: true });

    for (const dir of dirs) {
        const src = path.join(repoPath, dir);
        const dest = path.join(CLAUDE_CODE_DIR, dir);

        if (!(await pathExists(src))) continue;

        if (fs.existsSync(dest)) {
            fs.rmSync(dest, { recursive: true, force: true });
        }

        fs.symlinkSync(src, dest, 'junction');
        console.log(chalk.dim(`  linked: ${dir}/ → ${src}`));
    }

    console.log(chalk.green(`\nPlugin ready: ${chalk.dim(CLAUDE_CODE_DIR)}`));

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

export const applyRoocode = async (): Promise<void> => {
    if (!resolveRepoPath()) return;
    console.log(chalk.yellow('RooCode integration is not yet implemented.'));
};

export const applyOpenclaw = async (): Promise<void> => {
    if (!resolveRepoPath()) return;
    console.log(chalk.yellow('OpenClaw integration is not yet implemented.'));
};
