import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { HOME_DIR } from '@/_defs';
import { configManager } from '@/_libs/config';
import { isGitUrl } from '@/_libs';
import { scaffoldCommand } from './scaffold-command';


/**
 * 원격 Git URL을 받아 ~/.set-prompt/repo 경로에 클론하거나 pull로 최신화한 뒤 저장소를 등록한다.
 * 기존 로컬 repo가 있으면 타임스탬프 백업 후 새로 클론한다.
 * @returns 등록에 성공한 경우 true, 사용자가 취소한 경우 false
 */
const cloneRepo = async (remoteUrl: string): Promise<boolean> => {
    const proceed = await confirm({
        message: `Clone and register "${remoteUrl}"?`,
        default: true,
    });
    if (proceed == false) {
        console.log(chalk.yellow('Cancelled.'));
        return false;
    }

    const localPath = path.join(HOME_DIR, 'repo');

    if (fs.existsSync(localPath) == true) {
        console.warn(chalk.yellow(`Existing repo found. Backing up before proceeding.`));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(HOME_DIR, `repo.bak.${timestamp}`);
        fs.renameSync(localPath, backupPath);
        console.log(chalk.dim(`  Backed up to: ${backupPath}`));
    }

    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    console.log(`Cloning ${remoteUrl}...`);
    const result = spawnSync('git', ['clone', remoteUrl, localPath], { stdio: 'inherit' });
    if (result.status !== 0) {
        console.log('❌ Failed to clone. Check the URL and your git credentials.');
        process.exit(1);
    }
    console.log('✅ Cloned successfully.');

    await scaffoldCommand(localPath, { force: true });

    configManager.repo_path  = localPath;
    configManager.remote_url = remoteUrl;
    if (configManager.save() === false) {
        console.error(chalk.red('Failed to save config.'));
        return false;
    }
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
        return await cloneRepo(target);
    } catch (ex: any) {
        console.error(chalk.red(`Unexpected error: ${ex.message}`), ex);
        process.exit(1);
    }
};
