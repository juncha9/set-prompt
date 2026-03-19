import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { loadCommand } from '@/commands/load-command';
import { useCommand } from '@/commands/use-command';
import { configManager } from '@/_libs/config';


// 1. 이미 등록된 repo가 있으면 덮어쓸지 묻고, 없으면 바로 load
// 2. loadCommand(source)로 repo 등록 (로컬 경로 또는 원격 git URL)
// 3. repo 등록 확인 후 useCommand()로 AI agent 연동 (인터랙티브 선택)
export const defaultCommand = async (source: string): Promise<void> => {
    if (configManager.repo_path != null) {
        console.log(chalk.yellow(`A prompt source is already registered: ${configManager.repo_path}\nTo  use a different source, you can overwrite it with the new one.`));
        const overwrite = await confirm({
            message: 'Overwrite with new source?',
            default: false,
        });
        if (overwrite === false) {
            console.log(chalk.dim(`Keeping existing repo: ${configManager.repo_path}`));
        } else {
            const loadCompleted = await loadCommand(source);
            if (loadCompleted === false) {
                console.error(chalk.red('Failed to load new repo. Keeping existing repo.'));
                process.exit(1);
            }
        }
    } else {
        const loadCompleted = await loadCommand(source);
        if (loadCompleted === false) {
            console.error(chalk.red('Failed to load repo. No existing repo registered.'));
            process.exit(1);
        }
    }

    if (configManager.repo_path == null) {
        console.log(chalk.red('No prompt source registered.'));
        process.exit(1);
    }

    console.log(chalk.green(`Using repo: ${configManager.repo_path}`));

    await useCommand();
};
