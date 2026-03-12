import fs from 'fs';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { HOME_DIR, CONFIG_PATH, CLAUDE_CODE_DIR } from '@/_defs';

export const unloadCommand = async (): Promise<void> => {
    const targets = [
        { label: `Claude Code plugin dir  ${chalk.dim(CLAUDE_CODE_DIR)}`, path: CLAUDE_CODE_DIR },
        { label: `Config file             ${chalk.dim(CONFIG_PATH)}`, path: CONFIG_PATH },
        { label: `Home dir                ${chalk.dim(HOME_DIR)}`, path: HOME_DIR },
    ].filter(t => fs.existsSync(t.path));

    if (targets.length === 0) {
        console.log(chalk.yellow('Nothing to remove.'));
        return;
    }

    console.log(chalk.red('\nThe following will be removed:'));
    targets.forEach(t => console.log(`  ${t.label}`));

    const ok = await confirm({ message: 'Proceed?', default: false });
    if (!ok) {
        console.log(chalk.yellow('Cancelled.'));
        return;
    }

    for (const t of targets) {
        fs.rmSync(t.path, { recursive: true, force: true });
        console.log(chalk.dim(`  removed: ${t.path}`));
    }

    console.log(chalk.green('\nUninstalled.'));
};
