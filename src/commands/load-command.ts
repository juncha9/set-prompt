import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { HOME_DIR, REPO_DIRS } from '@/_defs';
import { configManager } from '@/_libs/config';
import { SET_PROMPT_GUIDE } from '@/_libs/templates';
import { isGitUrl } from '@/_libs';

// Returns true if setup was performed, false if skipped
const setupRepo = async (localPath: string): Promise<boolean> => {
    const createdFiles: string[] = [];

    const willSetup = await confirm({
        message: `repo structure will be set up in the provided directory. Do you want to proceed?`,
        default: true,
    });

    if (willSetup == false) {
        console.log(chalk.yellow('Repo structure setup skipped.'));
        return false;
    }

    try {
        const guidePath = path.join(localPath, 'SET_PROMPT_GUIDE.md');
        let writeGuide = true;

        if (fs.existsSync(guidePath)) {
            writeGuide = await confirm({
                message: 'SET_PROMPT_GUIDE.md already exists. Overwrite it?',
                default: false,
            });
            if (writeGuide) {
                fs.renameSync(guidePath, guidePath + '.bak');
                createdFiles.push('  SET_PROMPT_GUIDE.md.bak (renamed from SET_PROMPT_GUIDE.md)');
            }
        }

        if (writeGuide) {
            fs.writeFileSync(guidePath, SET_PROMPT_GUIDE, 'utf-8');
            createdFiles.push('  SET_PROMPT_GUIDE.md');
        }

        for (const dir of REPO_DIRS) {
            const dirPath = path.join(localPath, dir);
            if (fs.existsSync(dirPath)) {
                console.warn(chalk.yellow(`Directory already exists: ${dir}/ (skipping)`));
                continue;
            }
            fs.mkdirSync(dirPath, { recursive: true });
            createdFiles.push(`  ${dir}/`);
        }

        if (createdFiles.length > 0) {
            console.log('\n' + chalk.green('Created:'));
            createdFiles.forEach((line) => console.log(line));
        }

        return true;
    } catch (ex: any) {
        console.error(chalk.red(`Error setting up repo structure: ${ex.message}`));
        throw ex;
    }
};

// Returns true on success, false if cancelled
const loadRemoteRepo = async (remoteUrl: string): Promise<boolean> => {
    const proceed = await confirm({
        message: `Clone and register remote repo "${remoteUrl}"?`,
        default: true,
    });
    if (proceed === false) {
        console.log(chalk.yellow('Cancelled.'));
        return false;
    }

    const localPath = path.join(HOME_DIR, 'repo');
    const spinner = ora();

    if (fs.existsSync(localPath)) {
        console.warn(chalk.yellow(`Existing repo found at ${localPath}. Backing it up before proceeding.`));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(HOME_DIR, `repo.bak.${timestamp}`);
        fs.renameSync(localPath, backupPath);
        console.log(chalk.yellow(`Existing repo backed up to: ${backupPath}`));
    }

    if (fs.existsSync(localPath)) {
        spinner.start('Pulling latest...');
        const result = spawnSync('git', ['pull'], { cwd: localPath, stdio: 'pipe' });
        if (result.status !== 0) {
            spinner.fail('Failed to pull. Check your git credentials.');
            process.exit(1);
        }
        spinner.succeed('Pulled latest.');
    } else {
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        spinner.start(`Cloning ${remoteUrl}...`);
        const result = spawnSync('git', ['clone', remoteUrl, localPath], { stdio: 'pipe' });
        if (result.status !== 0) {
            spinner.fail('Failed to clone repository. Check the URL and your git credentials.');
            process.exit(1);
        }
        spinner.succeed('Cloned successfully.');
    }

    await setupRepo(localPath);

    if (configManager.save({ repo_path: localPath, remote_url: remoteUrl, claude_code: configManager.claude_code, roocode: configManager.roocode, openclaw: configManager.openclaw }) === false) {
        console.error(chalk.red('Failed to save config. Please check the error message above and try again.'));
        return false;
    }
    return true;
};

// Returns true on success, false if cancelled
const loadLocalRepo = async (target: string): Promise<boolean> => {
    const localPath = path.resolve(target);

    if (fs.existsSync(localPath) === false) {
        console.error(chalk.red(`Path does not exist, [${localPath}]`));
        process.exit(1);
    }

    if (fs.statSync(localPath).isDirectory() === false) {
        console.error(chalk.red(`Path is not a directory, [${localPath}]`));
        process.exit(1);
    }

    const proceed = await confirm({
        message: `Register local repo at "${localPath}"?`,
        default: true,
    });
    if (proceed === false) {
        console.log(chalk.yellow('Cancelled.'));
        return false;
    }

    await setupRepo(localPath);

    if (configManager.save({ repo_path: localPath, remote_url: null, claude_code: configManager.claude_code, roocode: configManager.roocode, openclaw: configManager.openclaw }) === false) {
        console.error(chalk.red('Failed to save config. Please check the error message above and try again.'));
        return false;
    }
    return true;
};

export const loadCommand = async (target?: string): Promise<boolean> => {
    try {
        const _target = target ?? process.cwd();

        let result: boolean;
        if (isGitUrl(_target) == true) {
            result = await loadRemoteRepo(_target);
        } else {
            result = await loadLocalRepo(_target);
        }
        return result;
    } catch (ex: any) {
        console.error(chalk.red(`Unexpected error, ${ex.message}`), ex);
        process.exit(1);
    }
};
