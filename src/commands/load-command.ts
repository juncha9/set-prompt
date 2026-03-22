import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { HOME_DIR } from '@/_defs';
import { configManager } from '@/_libs/config';
import { isGitUrl } from '@/_libs';
import { checkCommand } from './check-command';


/**
 * 원격 Git URL을 받아 ~/.set-prompt/repo 경로에 클론하거나 pull로 최신화한 뒤 저장소를 등록한다.
 * 기존 로컬 repo가 있으면 타임스탬프 백업 후 새로 클론한다.
 * @returns 등록에 성공한 경우 true, 사용자가 취소한 경우 false
 */
const loadRemoteRepo = async (remoteUrl: string): Promise<boolean> => {
    const proceed = await confirm({
        message: `Clone and register remote repo "${remoteUrl}"?`,
        default: true,
    });
    if (proceed == false) {
        // 확인 단계에서 취소한 경우, 기존 repo 유지하면서 load 명령 자체는 성공으로 간주 (false 반환) - defaultCommand에서 처리
        console.log(chalk.yellow('Cancelled.'));
        return false;
    }

    const localPath = path.join(HOME_DIR, 'repo');
    const spinner = ora();

    if (fs.existsSync(localPath) == true) {
        // 로컬 repo가 이미 존재하는 경우 백업 후 진행
        console.warn(chalk.yellow(`Existing repo found at ${localPath}. Backing it up before proceeding.`));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(HOME_DIR, `repo.bak.${timestamp}`);
        fs.renameSync(localPath, backupPath);
        console.log(chalk.yellow(`Existing repo backed up to: ${backupPath}`));
    }

    if (fs.existsSync(localPath) == true) {
        // 이미 클론된 repo가 존재하는 경우 최신 상태로 pull
        spinner.start('Pulling latest...');
        const result = spawnSync('git', ['pull'], { cwd: localPath, stdio: 'pipe' });
        if (result.status !== 0) {
            spinner.fail('Failed to pull. Check your git credentials.');
            process.exit(1);
        }
        spinner.succeed('Pulled latest.');
    } else {
        // repo가 존재하지 않는 경우 클론
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        spinner.start(`Cloning ${remoteUrl}...`);
        const result = spawnSync('git', ['clone', remoteUrl, localPath], { stdio: 'pipe' });
        if (result.status !== 0) {
            spinner.fail('Failed to clone repository. Check the URL and your git credentials.');
            process.exit(1);
        }
        spinner.succeed('Cloned successfully.');
    }

    await checkCommand(localPath, {
        force: true,
    });

    configManager.repo_path  = localPath;
    configManager.remote_url = remoteUrl;
    if (configManager.save() === false) {
        console.error(chalk.red('Failed to save config. Please check the error message above and try again.'));
        return false;
    }
    return true;
};

/**
 * 로컬 디렉터리 경로를 받아 유효성을 검사한 뒤 프롬프트 저장소로 등록한다.
 * 경로가 존재하지 않거나 디렉터리가 아니면 오류로 종료한다.
 * @returns 등록에 성공한 경우 true, 사용자가 취소한 경우 false
 */
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

    const result = await checkCommand(localPath, {
        force: false,
    });
    if(result == false) {
        
    }

    configManager.repo_path  = localPath;
    configManager.remote_url = null;
    if (configManager.save() === false) {
        console.error(chalk.red('Failed to save config. Please check the error message above and try again.'));
        return false;
    }
    return true;
};


/**
 * `set-prompt load` 명령어의 진입점.
 * target이 Git URL이면 원격 저장소를, 로컬 경로면 로컬 저장소를 등록한다.
 * target 미지정 시 현재 작업 디렉터리를 사용한다.
 * @returns 등록에 성공한 경우 true, 사용자가 취소하거나 실패한 경우 false
 */
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
