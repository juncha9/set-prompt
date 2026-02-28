import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { stringify } from 'smol-toml';
import { GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_PATH, REPO_CONFIG_FILENAME } from '@/_defs/index';
import { GlobalConfig } from '@/_types/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


const isGitUrl = (source: string): boolean => (
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('git@') ||
    source.startsWith('ssh://') ||
    (source.endsWith('.git') && (source.startsWith('http') || source.startsWith('git@') || source.startsWith('ssh://')))
);   

const initializeConfig = async (localPath: string): Promise<void> => {
    const name = path.basename(localPath);
    const description = 'My AI prompts repository';
    const author = '';

    const configPath = path.join(localPath, REPO_CONFIG_FILENAME);
    fs.writeFileSync(configPath, stringify({ name, version: '1.0.0', description, author }), 'utf-8');
};

const writeGlobalConfig = (config: GlobalConfig): void => {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    fs.writeFileSync(GLOBAL_CONFIG_PATH, stringify(config as unknown as Record<string, unknown>), 'utf-8');
};


const setupRepo = async (localPath: string): Promise<void> => {
    const spinner = ora('Setting up prompt repository...').start();
    const createdFiles: string[] = [];

    try {
        await initializeConfig(localPath);
        createdFiles.push(`  ${REPO_CONFIG_FILENAME}`);

        // Create SET_PROMPT_GUIDE.md
        const guidePath = path.join(localPath, 'SET_PROMPT_GUIDE.md');

        if (fs.existsSync(guidePath)) {
            fs.renameSync(guidePath, guidePath + '.bak');
            createdFiles.push('  SET_PROMPT_GUIDE.md.bak (renamed from SET_PROMPT_GUIDE.md)');
        }

        const guideContent = fs.readFileSync(path.join(__dirname, 'templates/SET_PROMPT_GUIDE.md'), 'utf-8');
        fs.writeFileSync(guidePath, guideContent, 'utf-8');
        createdFiles.push('  SET_PROMPT_GUIDE.md');

        const REPO_DIRS = ['skills', 'commands', 'hooks'];
        // Check and create prompt storage directories
        for (const dir of REPO_DIRS) {
            const dirPath = path.join(localPath, dir);
            if(fs.existsSync(dirPath) == true) {
                console.warn(chalk.yellow(`Directory already exists: ${dir}/ (skipping)`));
                continue;
            }
            fs.mkdirSync(dirPath, { recursive: true });
            createdFiles.push(`  ${dir}/`);
        }

        spinner.succeed('Prompt repository ready!');

        console.log('\n' + chalk.green('Created:'));
        createdFiles.forEach((line) => console.log(line));
    } catch (err) {
        spinner.fail('Setup failed');
        console.error(chalk.red(String(err)));
        process.exit(1);
    }
};

export const useCommand = async (target?: string): Promise<void> => {
    const _target = target ?? process.cwd();
    let isRemoteGit = false;
    let localPath: string;

    if (isGitUrl(_target) == true) {
        isRemoteGit = true;

        localPath = path.join(GLOBAL_CONFIG_DIR, 'repo');

        console.log(chalk.cyan(`Syncing from ${_target}...`));

        if (fs.existsSync(localPath) == true) {
            console.log(chalk.dim(`Already cloned — pulling latest...`));
            const ok = spawnSync('git', ['pull'], { cwd: localPath, stdio: 'inherit' }).status === 0;
            if (!ok) {
                console.log(chalk.red('Failed to pull. Check your git credentials.'));
                process.exit(1);
            }
        } else {
            fs.mkdirSync(path.dirname(localPath), { recursive: true });
            const ok = spawnSync('git', ['clone', _target, localPath], { stdio: 'inherit' }).status === 0;
            if (!ok) {
                console.log(chalk.red('Failed to clone repository. Check the URL and your git credentials.'));
                process.exit(1);
            }
        }

        if (!fs.existsSync(path.join(localPath, REPO_CONFIG_FILENAME))) {
            console.log(chalk.red(`Not a set-prompt repository — ${REPO_CONFIG_FILENAME} not found.`));
            process.exit(1);
        }
    } else {
        localPath = path.resolve(_target);

        if (!fs.existsSync(localPath)) {
            console.log(chalk.red(`Directory not found: ${localPath}`));
            process.exit(1);
        }

        if (!fs.statSync(localPath).isDirectory()) {
            console.log(chalk.red(`Not a directory: ${localPath}`));
            process.exit(1);
        }
    }

    await setupRepo(localPath);

    if (isRemoteGit == true) {
        writeGlobalConfig({
            repo_path: localPath,
            remote_url: _target,
        });
    }
    else {
        writeGlobalConfig({
            repo_path: localPath,
        });
    }

    console.log('\n' + chalk.green('✓ Prompt source registered'));
    console.log(`  Source : ${chalk.dim(_target)}`);
    if (isGitUrl(_target)) {
        console.log(`  Local  : ${chalk.dim(localPath)}`);
    }

    console.log('\n' + chalk.cyan('Next:'));
    console.log('  set-prompt claude-code');
    console.log('  set-prompt roocode');
};

