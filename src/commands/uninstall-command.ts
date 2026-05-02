import fs from 'fs';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { HOME_DIR, CONFIG_PATH, CLAUDE_CODE_DIR } from '@/_defs';
import { configManager } from '@/_libs/config';
import { unlinkClaudeCode, unlinkRooCode, unlinkOpenclaw, unlinkAntigravity, unlinkCodex, unlinkCursor, unlinkOpencode, unlinkGeminicli, unlinkHermes } from '@/commands/link-command';

export const uninstallCommand = async (): Promise<void> => {
    const targets = [
        { label: `Config file  ${chalk.dim(CONFIG_PATH)}`, path: CONFIG_PATH },
        { label: `Home dir     ${chalk.dim(HOME_DIR)}`,    path: HOME_DIR },
    ].filter(t => fs.existsSync(t.path));

    const hasClaudeCode  = configManager.isClaudeCodeEnabled();
    const hasRooCode     = configManager.isRooCodeEnabled();
    const hasOpenclaw    = configManager.isOpenclawEnabled();
    const hasAntigravity = configManager.isAntigravityEnabled();
    const hasCodex       = configManager.isCodexEnabled();
    const hasCursor      = configManager.isCursorEnabled();
    const hasOpencode    = configManager.isOpencodeEnabled();
    const hasGeminicli   = configManager.isGeminicliEnabled();
    const hasHermes      = configManager.isHermesEnabled();

    if (targets.length === 0 && !hasClaudeCode && !hasRooCode && !hasOpenclaw && !hasAntigravity && !hasCodex && !hasCursor && !hasOpencode && !hasGeminicli && !hasHermes) {
        console.log(chalk.yellow('Nothing to remove.'));
        return;
    }

    console.log(chalk.red('\nThe following will be removed:'));
    targets.forEach(t => console.log(`  ${t.label}`));
    if (hasClaudeCode)  { console.log(`  Claude Code plugin dir  ${chalk.dim(CLAUDE_CODE_DIR)}`); }
    if (hasRooCode)     { console.log(`  RooCode symlinks ${chalk.dim('(backup will be restored)')}`); }
    if (hasOpenclaw)    { console.log(`  OpenClaw symlinks ${chalk.dim('(backup will be restored)')}`); }
    if (hasAntigravity) { console.log(`  Antigravity symlinks ${chalk.dim('(backup will be restored)')}`); }
    if (hasCodex)       { console.log(`  Codex symlinks ${chalk.dim('(backup will be restored)')}`); }
    if (hasCursor)      { console.log(`  Cursor plugin dir ${chalk.dim('(symlink will be removed)')}`); }
    if (hasOpencode)    { console.log(`  OpenCode symlinks ${chalk.dim('(backup will be restored)')}`); }
    if (hasGeminicli)   { console.log(`  Gemini CLI symlinks ${chalk.dim('(backup will be restored)')}`); }
    if (hasHermes)      { console.log(`  Hermes plugin dir ${chalk.dim('(plugin folder will be removed)')}`); }

    const ok = await confirm({ message: 'Proceed?', default: false });
    if (!ok) {
        console.log(chalk.yellow('Cancelled.'));
        return;
    }

    if (hasClaudeCode)  { await unlinkClaudeCode(true); }
    if (hasRooCode)     { await unlinkRooCode(true); }
    if (hasOpenclaw)    { await unlinkOpenclaw(true); }
    if (hasAntigravity) { await unlinkAntigravity(true); }
    if (hasCodex)       { await unlinkCodex(true); }
    if (hasCursor)      { await unlinkCursor(true); }
    if (hasOpencode)    { await unlinkOpencode(true); }
    if (hasGeminicli)   { await unlinkGeminicli(true); }
    if (hasHermes)      { await unlinkHermes(true); }

    for (const t of targets) {
        fs.rmSync(t.path, { recursive: true, force: true });
        console.log(chalk.dim(`  removed: ${t.path}`));
    }

    console.log(chalk.green('\nUninstalled.'));
};
