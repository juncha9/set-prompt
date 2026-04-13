import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { HOME_DIR } from '@/_defs';
import { configManager } from '@/_libs/config';
import { isGitUrl } from '@/_libs';
import { printSaveHint } from '@/_libs/repo';
import { scaffoldCommand } from './scaffold-command';


/**
 * 원격 Git URL을 받아 ~/.set-prompt/repo 경로에 클론하거나 pull로 최신화한 뒤 저장소를 등록한다.
 * 기존 로컬 repo가 있으면 타임스탬프 백업 후 새로 클론한다.
 * @returns 등록에 성공한 경우 true, 사용자가 취소한 경우 false
 */
const cloneRepo = async (remoteUrl: string): Promise<boolean> => {
    const localPath = path.join(HOME_DIR, 'repo');

    let backupPath: string | null = null;
    if (fs.existsSync(localPath) == true) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = path.join(HOME_DIR, `repo.bak.${timestamp}`);
        try {
            fs.renameSync(localPath, backupPath);
            console.log(chalk.yellow('  backed up') + chalk.dim(` existing repo → ${backupPath}`));
        } catch (ex: any) {
            if (ex.code === 'EPERM') {
                console.error(chalk.red('❌ Cannot rename existing repo — it may be open in another process.'));
                console.log(chalk.dim(`   Close any editors or terminals using: ${localPath}`));
            } else {
                console.error(chalk.red(`❌ Failed to backup existing repo: ${ex.message}`));
            }
            return false;
        }
    }

    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    console.log(`Cloning ${remoteUrl}...`);
    const result = spawnSync('git', ['clone', remoteUrl, localPath], { stdio: 'inherit' });
    if (result.status !== 0) {
        console.log('❌ Failed to clone. Check the URL and your git credentials.');
        process.exit(1);
    }
    console.log('✅ Cloned successfully.');

    if (backupPath != null) {
        fs.rmSync(backupPath, { recursive: true, force: true });
        console.log(chalk.red('  removed') + chalk.dim(` backup → ${backupPath}`));
    }

    await scaffoldCommand(localPath);

    configManager.repo_path  = localPath;
    configManager.remote_url = remoteUrl;
    if (configManager.save() === false) {
        console.error(chalk.red('Failed to save config.'));
        return false;
    }

    // Nudge the user to push scaffold-generated files if the clone arrived empty.
    printSaveHint(localPath);

    return true;
};


/**
 * `set-prompt install` 명령어의 진입점.
 * Git URL만 허용한다.
 */
export const installCommand = async (target: string): Promise<boolean> => {
    try {
        if (isGitUrl(target) === false) {
            console.error(chalk.red('❌ Only remote git URLs are supported.'));
            console.log(chalk.dim('   Example: set-prompt install https://github.com/you/my-prompts'));
            process.exit(1);
        }

        const normalizeUrl = (url: string) => url.replace(/\.git$/, '').toLowerCase();

        if (configManager.repo_path != null) {
            if (normalizeUrl(configManager.remote_url ?? '') === normalizeUrl(target)) {
                console.error(chalk.red(`❌ Already installed from the same URL: ${target}`));
                console.log(chalk.dim('   Use `set-prompt repo pull` to pull the latest changes.'));
                return false;
            }
            console.warn(chalk.yellow(`⚠ Switching repo: ${configManager.remote_url} → ${target}`));
            const proceed = await confirm({ message: 'Replace existing installation?', default: false });
            if (!proceed) {
                console.log(chalk.yellow('Cancelled.'));
                return false;
            }
        } else {
            const proceed = await confirm({ message: `Clone and register "${target}"?`, default: true });
            if (!proceed) {
                console.log(chalk.yellow('Cancelled.'));
                return false;
            }
        }

        return await cloneRepo(target);
    } catch (ex: any) {
        console.error(chalk.red(`Unexpected error: ${ex.message}`), ex);
        process.exit(1);
    }
};
