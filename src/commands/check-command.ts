import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { PROMPT_DIR_NAMES } from '@/_defs';
import { SET_PROMPT_GUIDE } from '@/_libs/templates';

/**
 * 지정된 로컬 경로에 프롬프트 저장소 기본 구조(SET_PROMPT_GUIDE.md, skills/, commands/ 등)를 생성한다.
 * 이미 파일/디렉터리가 존재하면 덮어쓸지 사용자에게 확인하고, 생성된 항목 목록을 출력한다.
 * @returns 설정을 진행한 경우 true, 사용자가 취소한 경우 false
 */
export const checkCommand = async (localPath: string, options: { force?: boolean } = {}): Promise<boolean> => {
    const { force } = options;
    const createdFiles: string[] = [];

    if(force == false) {
        const doThis = await confirm({
            message: `Set up repo structure at '${localPath}'?`,
            default: true,
        });

        if (doThis == false) {
            console.log(chalk.yellow('Repo structure setup skipped.'));
            return false;
        }
    }

    try {
        const stat = fs.statSync(localPath);
        if(stat == null || stat.isDirectory() == false) {
            console.error(chalk.red(`Invalid path: '${localPath}'\nPlease provide a valid directory path.`));
            return false;
        } 

        const guideMdPath = path.join(localPath, 'SET_PROMPT_GUIDE.md');

        if(force == true) {
            fs.writeFileSync(guideMdPath, SET_PROMPT_GUIDE, {
                encoding: 'utf-8',
                flag: "w"
            });
            createdFiles.push('  SET_PROMPT_GUIDE.md');
        }
        else if (fs.existsSync(guideMdPath) == false) {
            fs.writeFileSync(guideMdPath, SET_PROMPT_GUIDE, {
                encoding: 'utf-8',
                flag: "w"
            });
            createdFiles.push('  SET_PROMPT_GUIDE.md');
        }

        for (const dirName of PROMPT_DIR_NAMES) {
            const dirPath = path.join(localPath, dirName);
            if (fs.existsSync(dirPath) == true) {
                console.warn(chalk.yellow(`Directory already exists: '${dirName}' (skipping)`));
                continue;
            }
            fs.mkdirSync(dirPath, { recursive: true });
            createdFiles.push(`  ${dirName}/`);
        }

        if (createdFiles.length > 0) {
            console.log(chalk.green('Created:'));
            createdFiles.forEach((line) => console.log(line));
        }

        return true;
    } catch (ex: any) {
        console.error(chalk.red(`Failed to check repo structure: ${ex.message}`), ex);
        throw ex;
    }
};
