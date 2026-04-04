import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { PROMPT_DIR_NAMES, TAB } from '@/_defs';
import { SET_PROMPT_GUIDE } from '@/_libs/templates';
import { configManager } from '@/_libs/config';

const REQUIRED_DIRS = ['skills', 'commands'] as const;
const OPTIONAL_DIRS = ['hooks', 'agents'] as const;



/**
 * 주어진 경로의 레포 디렉터리 구조를 콘솔에 출력하고 유효성을 검사한다.
 * - REQUIRED_DIRS(skills, commands)가 모두 존재하면 true를 반환한다.
 * - 하나라도 누락되면 해당 항목을 빨간색으로 표시하고 false를 반환한다.
 * - OPTIONAL_DIRS(hooks)는 존재 여부만 표시하며 반환값에 영향을 주지 않는다.
 */
const printStructure = async (localPath: string): Promise<boolean> => {
    let valid = true;
    for (const dir of REQUIRED_DIRS) {
        const exists = fs.existsSync(path.join(localPath, dir));
        if (exists) {
            console.log(`${TAB}✅ ${dir}/`);
        } else {
            console.log(`${TAB}❌ ${dir}/ ${chalk.red('(missing)')}`);
            valid = false;
        }
    }
    for (const dir of OPTIONAL_DIRS) {
        const exists = fs.existsSync(path.join(localPath, dir));
        console.log(`${TAB}${chalk.dim(exists ? '✓' : '○')} ${dir}/ ${exists ? '' : chalk.dim('(optional)')}`);
    }
    return valid;
};



/**
 * 레포의 디렉터리 구조를 스캐폴딩한다.
 *
 * 동작 흐름:
 * 1. `localPath`가 주어지면 해당 경로를, 없으면 등록된 `repo_path`를 대상으로 사용한다.
 * 2. 대상 경로가 유효한 디렉터리인지 확인한다.
 * 3. `printStructure`로 현재 구조를 출력하고 필수 디렉터리가 모두 있는지 확인한다.
 * 4. 구조가 유효하고 `force` 옵션이 없으면 그대로 종료한다.
 * 5. 누락된 디렉터리가 있거나 `force`가 true이면:
 *    - `force`가 아닐 경우 사용자에게 계속할지 확인(confirm)한다.
 *    - SET_PROMPT_GUIDE.md 파일을 생성(또는 덮어쓰기)한다.
 *    - PROMPT_DIR_NAMES에 정의된 디렉터리를 순서대로 생성한다.
 *    - 이미 존재하는 디렉터리는 건너뛴다.
 * 6. 성공 시 true, 사용자가 취소하면 false를 반환한다.
 */
export const scaffoldCommand = async (localPath?: string, options: { force?: boolean } = {}): Promise<boolean> => {
    try {
        let targetPath: string | null = null;

        if (localPath != null) {
            targetPath = localPath;
        } else {
            if (configManager.repo_path != null) {
                targetPath = configManager.repo_path;
            } else {
                console.error(chalk.red('No path provided and no repo registered. Please provide a path.'));
                process.exit(1);
            }
        }

        if (fs.existsSync(targetPath) === false || fs.statSync(targetPath).isDirectory() === false) {
            console.error(chalk.red(`Invalid directory path: '${targetPath}'`));
            process.exit(1);
        }

        if (options.force !== true) {
            console.log(chalk.dim(`Checking repo structure at: ${targetPath}`));
        }
        const valid = options.force === true ? false : await printStructure(targetPath);

        if (valid) {
            console.log(chalk.green('Repo structure is valid.'));
            return true;
        }

        if (!valid) {
            if (options.force !== true) {
                const proceed = await confirm({
                    message: 'Some directories are missing. Scaffold them now?',
                    default: true,
                });
                if (proceed === false) {
                    console.log(chalk.yellow('Scaffold skipped.'));
                    return false;
                }
            }

            const created: string[] = [];

            const guideMdPath = path.join(targetPath, 'SET_PROMPT_GUIDE.md');
            if (options.force === true || fs.existsSync(guideMdPath) === false) {
                fs.writeFileSync(guideMdPath, SET_PROMPT_GUIDE, { encoding: 'utf-8', flag: 'w' });
                created.push('  SET_PROMPT_GUIDE.md');
            }

            for (const dirName of PROMPT_DIR_NAMES) {
                const dirPath = path.join(targetPath, dirName);
                if (fs.existsSync(dirPath)) {
                    console.warn(chalk.yellow(`Directory already exists: '${dirName}' (skipping)`));
                } else {
                    fs.mkdirSync(dirPath, { recursive: true });
                    created.push(`  ${dirName}/`);
                }
                const gitkeepPath = path.join(dirPath, '.gitkeep');
                if (!fs.existsSync(gitkeepPath)) {
                    fs.writeFileSync(gitkeepPath, '', { encoding: 'utf-8' });
                    if (!created.includes(`  ${dirName}/`)) {
                        created.push(`  ${dirName}/.gitkeep`);
                    }
                }
            }

            if (created.length > 0) {
                console.log(chalk.green('Created:'));
                created.forEach((line) => console.log(line));
            }
        }

        return true;
    } catch (ex: any) {
        console.error(chalk.red(`Failed to scaffold repo structure: ${ex.message}`), ex);
        throw ex;
    }
};
