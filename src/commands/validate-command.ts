import path from 'path';
import chalk from 'chalk';
import { pathExists } from 'fs-extra';
import { TAB } from '@/_defs';
import { configManager } from '@/_libs/config';

const REQUIRED_DIRS = ['skills', 'commands'] as const;
const OPTIONAL_DIRS = ['hooks'] as const;

const validate = async (localPath: string) => {
    console.log(chalk.dim(`Validating repo structure at: ${chalk.dim(localPath)}`));

    let valid = true;

    for (const dir of REQUIRED_DIRS) {
        const exists = await pathExists(path.join(localPath, dir));
        if (exists) {
            console.log(`${TAB}${chalk.green('✓')} ${dir}/`);
        } else {
            console.log(`${TAB}${chalk.red('✗')} ${dir}/ ${chalk.red('(missing)')}`);
            valid = false;
        }
    }

    for (const dir of OPTIONAL_DIRS) {
        const exists = await pathExists(path.join(localPath, dir));
        console.log(`${TAB}${chalk.dim(exists ? '✓' : '○')} ${dir}/ ${exists ? '' : chalk.dim('(optional)')}`);
    }

    return valid;
}

export const validateCommand = async (localPath?: string): Promise<void> => {
    try {
        let targetPath:string|null = null;
        if(localPath != null) {
            targetPath = localPath;
        } else {
            console.info(chalk.dim('No local path provided, checking config...'));
            if (configManager.repo_path != null) {
                console.info(chalk.dim(`Found config with repo_path, ${chalk.dim(configManager.repo_path)}`));
                targetPath = configManager.repo_path;
            } else {
                console.log(chalk.yellow('No target path provided and no config found'));
                console.log(chalk.yellow(`Exiting...`));
                process.exit(1);
            }
        }

        const result = await validate(targetPath!);
        console.log(result ? chalk.green('Repo structure is valid.') : chalk.red('Repo structure is invalid.'));

    }
    catch (ex:any) {
        console.error(chalk.red(`Unexpected error, ${ex.message}`), ex);
        process.exit(1);
    }
    return;
};
