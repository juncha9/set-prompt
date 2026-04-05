import fs from 'fs';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { HOME_DIR, CONFIG_PATH, CLAUDE_CODE_DIR } from '@/_defs';
import { configManager } from '@/_libs/config';
import { unlinkClaudeCode, unlinkRooCode, unlinkOpenclaw, unlinkAntigravity } from '@/commands/link-command';

export const uninstallCommand = async (): Promise<void> => {
    const targets = [
        { label: `Config file  ${chalk.dim(CONFIG_PATH)}`, path: CONFIG_PATH },
        { label: `Home dir     ${chalk.dim(HOME_DIR)}`,    path: HOME_DIR },
    ].filter(t => fs.existsSync(t.path));

    const hasClaudeCode  = configManager.isClaudeCodeEnabled();
    const hasRooCode     = configManager.isRooCodeEnabled();
    const hasOpenclaw    = configManager.isOpenclawEnabled();
    const hasAntigravity = configManager.isAntigravityEnabled();

    if (targets.length === 0 && !hasClaudeCode && !hasRooCode && !hasOpenclaw && !hasAntigravity) {
        console.log(chalk.yellow('Nothing to remove.'));
        return;
    }

    console.log(chalk.red('\nThe following will be removed:'));
    targets.forEach(t => console.log(`  ${t.label}`));
    if (hasClaudeCode)  { console.log(`  Claude Code plugin dir  ${chalk.dim(CLAUDE_CODE_DIR)}`); }
    if (hasRooCode)     { console.log(`  RooCode symlinks ${chalk.dim('(backup will be restored)')}`); }
    if (hasOpenclaw)    { console.log(`  OpenClaw symlinks ${chalk.dim('(backup will be restored)')}`); }
    if (hasAntigravity) { console.log(`  Antigravity symlinks ${chalk.dim('(backup will be restored)')}`); }

    const ok = await confirm({ message: 'Proceed?', default: false });
    if (!ok) {
        console.log(chalk.yellow('Cancelled.'));
        return;
    }

    if (hasClaudeCode)  { await unlinkClaudeCode(true); }
    if (hasRooCode)     { await unlinkRooCode(true); }
    if (hasOpenclaw)    { await unlinkOpenclaw(true); }
    if (hasAntigravity) { await unlinkAntigravity(true); }

    for (const t of targets) {
        fs.rmSync(t.path, { recursive: true, force: true });
        console.log(chalk.dim(`  removed: ${t.path}`));
    }

    console.log(chalk.green('\nUninstalled.'));
};
