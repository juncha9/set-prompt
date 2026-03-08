import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { HOME_DIR, CONFIG_PATH } from '@/_defs';
import { getConfig, setConfig } from '@/_libs/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isGitUrl = (source: string): boolean => (
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('git@') ||
    source.startsWith('ssh://') ||
    (source.endsWith('.git') && (source.startsWith('http') || source.startsWith('git@') || source.startsWith('ssh://')))
);

const setupRepo = async (localPath: string): Promise<void> => {
    //setup repo structure (SET_PROMPT_GUIDE.md + ...)
    const createdFiles: string[] = [];

    const willSetup = await confirm({
        message: `repo structure will be set up in the provided directory. Do you want to proceed?`,
        default: true,
    });
    
    if (willSetup == false) {
        console.log(chalk.yellow('Repo structure setup skipped.'));
        return;
    }   

    try {
        // SET_PROMPT_GUIDE.md
        const guidePath = path.join(localPath, 'SET_PROMPT_GUIDE.md');
        let writeGuide = true;

        if (fs.existsSync(guidePath)) {
            writeGuide = await confirm({
                message: ' SET_PROMPT_GUIDE.md already exists. Overwrite it?',
                default: false,
            });

            if (writeGuide) {
                fs.renameSync(guidePath, guidePath + '.bak');
                createdFiles.push('  SET_PROMPT_GUIDE.md.bak (renamed from SET_PROMPT_GUIDE.md)');
            }
        }

        if (writeGuide) {
            const guideContent = fs.readFileSync(path.join(__dirname, 'templates/SET_PROMPT_GUIDE.md'), 'utf-8');
            fs.writeFileSync(guidePath, guideContent, 'utf-8');
            createdFiles.push('  SET_PROMPT_GUIDE.md');
        }

        const REPO_DIRS = ['skills', 'commands', 'hooks'];
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
    } catch (ex:any) {
        console.error(chalk.red(`Error setting up repo structure: ${ex.message}`));
        throw ex;
    }
};

export const setupCommand = async (target?: string): Promise<void> => {
    try {
        const _target = target ?? process.cwd();
        let isRemoteGit = false;
        let localPath: string;

        if (isGitUrl(_target) == true) {
            isRemoteGit = true;
            localPath = path.join(HOME_DIR, 'repo');
            const spinner = ora();

            if (fs.existsSync(localPath) == true) {
                console.warn(chalk.yellow(`Existing repo found at ${localPath}. Backing it up before proceeding.`));
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = path.join(HOME_DIR, `repo.bak.${timestamp}`);
                fs.renameSync(localPath, backupPath);
                console.log(chalk.yellow(`Existing repo backed up to: ${backupPath}`));
            }

            if (fs.existsSync(localPath) == true) {
                spinner.start('Pulling latest...');
                const result = spawnSync('git', ['pull'], { cwd: localPath, stdio: 'pipe' });
                if (result.status !== 0) {
                    spinner.fail('Failed to pull. Check your git credentials.');
                    process.exit(1);
                }
                spinner.succeed('Pulled latest.');
            } else {
                const dirName = path.dirname(localPath);
                fs.mkdirSync(dirName, { recursive: true });
                spinner.start(`Cloning ${_target}...`);
                const result = spawnSync('git', ['clone', _target, localPath], { stdio: 'pipe' });
                if (result.status !== 0) {
                    spinner.fail('Failed to clone repository. Check the URL and your git credentials.');
                    process.exit(1);
                }
                spinner.succeed('Cloned successfully.');
            }

        } else {
            localPath = path.resolve(_target);

            if (fs.existsSync(localPath) == false) {
                console.error(chalk.red(`Path does not exist, [${localPath}]`));
                process.exit(1);
            }

            if (fs.statSync(localPath).isDirectory() == false) {
                console.error(chalk.red(`Path is not a directory, [${localPath}]`));
                process.exit(1);
            }
        }

        await setupRepo(localPath);

        
        let configResult:boolean = false;
        if (isRemoteGit == true) {
            configResult = setConfig({
                repo_path: localPath,
                remote_url: _target,
            });
        } else {
            configResult = setConfig({
                repo_path: localPath,
            });
        }

        if (configResult == false) {
            console.error(chalk.red('Failed to save config. Please check the error message above and try again.'));
            process.exit(1);
        }

        const config = getConfig();
        if (config == null) {
            console.error(chalk.red('Failed to load config after saving. Please check the error message above and try again.'));
            process.exit(1);
        }

    }
    catch(ex: any) {
        console.error(chalk.red(`Unexpected error, ${ex.message}`) ,ex);
    }
};
