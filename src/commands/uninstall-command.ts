import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { HOME_DIR, CONFIG_PATH, CLAUDE_CODE_DIR, PROMPT_DIR_NAMES, ROO_DIR, ROO_BACKUP_DIR } from '@/_defs';
import { configManager } from '@/_libs/config';

const PLUGIN_NAME = 'set-prompt';

/**
 * ~/.claude/settings.json 에서 set-prompt 관련 항목을 제거합니다.
 * 기존 설정은 보존하고 해당 키만 삭제합니다. 쓰기 전 백업을 생성하고 성공 시 삭제합니다.
 */
const rollbackClaudeCode = (): void => {
    const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(claudeSettingsPath) === false) { return; }

    try {
        // Backup first — skip cleanup if backup fails
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${claudeSettingsPath}.bak.${timestamp}`;
        try {
            fs.copyFileSync(claudeSettingsPath, backupPath);
        } catch (ex: any) {
            console.warn(chalk.yellow(`  ⚠ Could not create backup: ${ex.message} — skipping cleanup`));
            return;
        }

        const raw = fs.readFileSync(claudeSettingsPath, 'utf-8');
        let settings: Record<string, any>;
        try {
            const parsed = JSON.parse(raw);
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                console.warn(chalk.yellow('  ⚠ settings.json has unexpected format — skipping cleanup'));
                fs.unlinkSync(backupPath);
                return;
            }
            settings = parsed;
        } catch {
            console.warn(chalk.yellow('  ⚠ Failed to parse settings.json — skipping cleanup'));
            fs.unlinkSync(backupPath);
            return;
        }

        // Remove our keys
        if (settings.extraKnownMarketplaces?.[PLUGIN_NAME] !== undefined) {
            delete settings.extraKnownMarketplaces[PLUGIN_NAME];
        }
        if (settings.enabledPlugins?.[`${PLUGIN_NAME}@${PLUGIN_NAME}`] !== undefined) {
            delete settings.enabledPlugins[`${PLUGIN_NAME}@${PLUGIN_NAME}`];
        }

        try {
            fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        } catch (ex: any) {
            try {
                fs.copyFileSync(backupPath, claudeSettingsPath);
                fs.unlinkSync(backupPath);
                console.warn(chalk.yellow('  ⚠ Write failed — rolled back to original.'));
            } catch {
                console.error(chalk.red(`  ❌ Rollback failed. Backup preserved at: ${backupPath}`));
            }
            throw ex;
        }

        try { fs.unlinkSync(backupPath); } catch { /* ignore */ }

        console.log(chalk.dim(`  removed set-prompt entries from: ${claudeSettingsPath}`));
    } catch (ex: any) {
        console.error(chalk.red(`  ❌ Failed to clean up settings.json: ${ex.message}`));
    }
};

const rollbackRooCode = (): void => {
    const backupPath = configManager.roocode?.backup_path ?? ROO_BACKUP_DIR;

    // Remove symlinks
    for (const dir of PROMPT_DIR_NAMES) {
        const target = path.join(ROO_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.dim(`  removed symlink: ${target}`));
        }
    }

    // Restore backup if exists
    if (fs.existsSync(backupPath) === false) { return; }
    try {
        for (const dir of PROMPT_DIR_NAMES) {
            const src = path.join(backupPath, dir);
            const dest = path.join(ROO_DIR, dir);
            if (fs.existsSync(src) === false) { continue; }
            fs.renameSync(src, dest);
            console.log(chalk.dim(`  restored: ${dir}/`));
        }
        fs.rmdirSync(backupPath);
    } catch (ex: any) {
        console.error(chalk.red(`  ❌ Failed to restore RooCode backup: ${ex.message}`));
    }
};

export const uninstallCommand = async (): Promise<void> => {
    const targets = [
        { label: `Claude Code plugin dir  ${chalk.dim(CLAUDE_CODE_DIR)}`, path: CLAUDE_CODE_DIR },
        { label: `Config file             ${chalk.dim(CONFIG_PATH)}`, path: CONFIG_PATH },
        { label: `Home dir                ${chalk.dim(HOME_DIR)}`, path: HOME_DIR },
    ].filter(t => fs.existsSync(t.path));

    const hasClaudeCodeSettings = configManager.isClaudeCodeEnabled();
    const hasRooCode = configManager.isRooCodeEnabled();

    if (targets.length === 0 && hasClaudeCodeSettings === false && hasRooCode === false) {
        console.log(chalk.yellow('Nothing to remove.'));
        return;
    }

    console.log(chalk.red('\nThe following will be removed:'));
    targets.forEach(t => console.log(`  ${t.label}`));
    if (hasClaudeCodeSettings) {
        const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        console.log(`  set-prompt entries in ${chalk.dim(claudeSettingsPath)}`);
    }
    if (hasRooCode) {
        console.log(`  RooCode symlinks in ${chalk.dim(ROO_DIR)} ${chalk.dim('(backup will be restored)')}`);
    }

    const ok = await confirm({ message: 'Proceed?', default: false });
    if (ok === false) {
        console.log(chalk.yellow('Cancelled.'));
        return;
    }

    if (hasClaudeCodeSettings) {
        rollbackClaudeCode();
    }

    if (hasRooCode) {
        rollbackRooCode();
    }

    for (const t of targets) {
        fs.rmSync(t.path, { recursive: true, force: true });
        console.log(chalk.dim(`  removed: ${t.path}`));
    }

    console.log(chalk.green('\nUninstalled.'));
};
