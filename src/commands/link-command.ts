import path from 'path';
import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import { confirm, checkbox } from '@inquirer/prompts';
import { pathExists } from 'fs-extra';
import { CLAUDE_CODE_DIR, ROO_DIR, ROO_BACKUP_DIR, OPENCLAW_DIR, OPENCLAW_BACKUP_DIR, ANTIGRAVITY_DIR, ANTIGRAVITY_BACKUP_DIR, AGENT_PROMPT_DIRS, ALL_AGENTS, TOOLS } from '@/_defs';
import { configManager } from '@/_libs/config';

const resolveRepoPath = (): string | null => {
    if (configManager.repo_path == null) {
        console.error(chalk.red('❌ No repo installed.'));
        console.log(chalk.yellow('Run: set-prompt install <git-url>'));
        return null;
    }
    return configManager.repo_path;
};

const PLUGIN_NAME = 'set-prompt';

export const linkClaudeCode = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    const setClaudeCodeAssets = async (): Promise<boolean> => {
        try {
            fs.mkdirSync(CLAUDE_CODE_DIR, { recursive: true });

            const marketplaceMetaDir = path.join(CLAUDE_CODE_DIR, '.claude-plugin');
            fs.mkdirSync(marketplaceMetaDir, { recursive: true });
            const marketplaceJson = {
                name: PLUGIN_NAME,
                owner: { name: os.userInfo().username },
                metadata: { description: 'Managed by set-prompt', version: '1.0.0' },
                plugins: [{ name: PLUGIN_NAME, source: `./plugins/${PLUGIN_NAME}`, description: 'Managed by set-prompt' }],
            };
            fs.writeFileSync(
                path.join(marketplaceMetaDir, 'marketplace.json'),
                JSON.stringify(marketplaceJson, null, 2),
                'utf-8',
            );
            console.log(chalk.dim('  ├── .claude-plugin/'));
            console.log(chalk.dim('  │   └── marketplace.json') + chalk.green(' ✓'));

            const pluginDir = path.join(CLAUDE_CODE_DIR, 'plugins', PLUGIN_NAME);
            fs.mkdirSync(pluginDir, { recursive: true });
            console.log(chalk.dim('  └── plugins/'));
            console.log(chalk.dim(`      └── ${PLUGIN_NAME}/`));

            const pluginMetaDir = path.join(pluginDir, '.claude-plugin');
            fs.mkdirSync(pluginMetaDir, { recursive: true });
            const pluginJson = {
                name: PLUGIN_NAME,
                version: '1.0.0',
                description: 'Managed by set-prompt',
                author: { name: path.basename(repoPath) },
            };
            fs.writeFileSync(
                path.join(pluginMetaDir, 'plugin.json'),
                JSON.stringify(pluginJson, null, 2),
                'utf-8',
            );
            console.log(chalk.dim('          ├── .claude-plugin/'));
            console.log(chalk.dim('          │   └── plugin.json') + chalk.green(' ✓'));

            const linked: { dir: string; src: string }[] = [];
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.CLAUDECODE]) {
                const src = path.join(repoPath, dir);
                const dest = path.join(pluginDir, dir);

                if ((await pathExists(src)) === false) { continue; }

                if (fs.existsSync(dest)) {
                    fs.rmSync(dest, { recursive: true, force: true });
                }

                const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
                fs.symlinkSync(src, dest, symlinkType);
                linked.push({ dir, src });
            }

            for (const { dir, src } of linked) {
                const isLast = linked[linked.length - 1].dir === dir;
                const branch = isLast ? '└──' : '├──';
                console.log(chalk.dim(`          ${branch} `) + chalk.bold(`${dir}/`) + chalk.dim(` → ${src}`) + chalk.green(' ✓'));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to build plugin structure: ${ex.message}`));
            return false;
        }
    };

    const registerToClaudeSettings = (): boolean => {
        const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        try {
            let settings: Record<string, any> = {};
            if (fs.existsSync(claudeSettingsPath)) {
                const raw = fs.readFileSync(claudeSettingsPath, 'utf-8');
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        settings = parsed;
                    } else {
                        console.warn(chalk.yellow('  ⚠ settings.json has unexpected format — proceeding with caution'));
                    }
                } catch {
                    console.warn(chalk.yellow('  ⚠ Failed to parse settings.json — will not overwrite existing file'));
                    console.error(chalk.red('❌ Could not register plugin. Please add manually.'));
                    return false;
                }
            }

            settings.extraKnownMarketplaces = {
                ...settings.extraKnownMarketplaces,
                [PLUGIN_NAME]: { source: { source: 'directory', path: CLAUDE_CODE_DIR } },
            };
            settings.enabledPlugins = {
                ...settings.enabledPlugins,
                [`${PLUGIN_NAME}@${PLUGIN_NAME}`]: true,
            };

            let backupPath: string | null = null;
            if (fs.existsSync(claudeSettingsPath)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                backupPath = `${claudeSettingsPath}.bak.${timestamp}`;
                try {
                    fs.copyFileSync(claudeSettingsPath, backupPath);
                } catch (ex: any) {
                    console.warn(chalk.yellow(`  ⚠ Could not create backup: ${ex.message}`));
                    backupPath = null;
                }
            }

            try {
                fs.mkdirSync(path.dirname(claudeSettingsPath), { recursive: true });
                fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
            } catch (ex: any) {
                // Rollback on write failure
                if (backupPath !== null) {
                    try {
                        fs.copyFileSync(backupPath, claudeSettingsPath);
                        fs.unlinkSync(backupPath);
                        console.warn(chalk.yellow('  ⚠ Write failed — rolled back to original.'));
                    } catch {
                        console.error(chalk.red(`  ❌ Rollback failed. Backup preserved at: ${backupPath}`));
                    }
                }
                throw ex;
            }

            if (backupPath !== null) {
                try { fs.unlinkSync(backupPath); } catch { /* ignore */ }
            }

            console.log(`✅ Registered to Claude Code settings.`);
            console.log(chalk.dim(`   ${claudeSettingsPath}`));
            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to update settings.json: ${ex.message}`));
            console.log(chalk.dim('   Please add the plugin manually via Claude Code /plugins.'));
            return false;
        }
    };

    console.log(chalk.green(`\nSetting up Claude Code plugin...`));
    console.log(chalk.dim(CLAUDE_CODE_DIR));

    const structureOk = await setClaudeCodeAssets();
    if (structureOk === false) { return; }

    const settingsOk = registerToClaudeSettings();
    if (settingsOk === false) { return; }

    configManager.claude_code = { path: CLAUDE_CODE_DIR };
    configManager.save();
};

export const linkRooCode = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    console.log(chalk.green(`\nSetting up RooCode integration...`));
    console.log(chalk.dim(ROO_DIR));

    const roocodeDirs = AGENT_PROMPT_DIRS[TOOLS.ROOCODE];

    const backupExistingRooCodeFiles = async (): Promise<boolean> => {
        try {
            fs.mkdirSync(ROO_DIR, { recursive: true });

            const dirsToBackup: string[] = [];
            for (const dir of roocodeDirs) {
                const target = path.join(ROO_DIR, dir);
                if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false) {
                    dirsToBackup.push(dir);
                }
            }

            if (dirsToBackup.length === 0) {
                return true;
            }

            fs.mkdirSync(ROO_BACKUP_DIR, { recursive: true });
            for (const dir of dirsToBackup) {
                const src = path.join(ROO_DIR, dir);
                const dest = path.join(ROO_BACKUP_DIR, dir);
                fs.renameSync(src, dest);
                console.log(chalk.dim(`  backed up: ${dir}/ → ${dest}`));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to backup existing directories: ${ex.message}`));
            return false;
        }
    };

    const setRooCodeAssets = async (): Promise<boolean> => {
        try {
            const linked: { dir: string; src: string }[] = [];

            for (const dir of roocodeDirs) {
                const src = path.join(repoPath, dir);
                const dest = path.join(ROO_DIR, dir);

                if ((await pathExists(src)) === false) { continue; }

                if (fs.existsSync(dest)) {
                    fs.rmSync(dest, { recursive: true, force: true });
                }

                const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
                fs.symlinkSync(src, dest, symlinkType);
                linked.push({ dir, src });
            }

            for (const { dir, src } of linked) {
                const isLast = linked[linked.length - 1].dir === dir;
                const branch = isLast ? '└──' : '├──';
                console.log(chalk.dim(`  ${branch} `) + chalk.bold(`${dir}/`) + chalk.dim(` → ${src}`) + chalk.green(' ✓'));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to create symlinks: ${ex.message}`));
            return false;
        }
    };

    const backupOk = await backupExistingRooCodeFiles();
    if (backupOk === false) { return; }

    const linkOk = await setRooCodeAssets();
    if (linkOk === false) { return; }

    configManager.roocode = { path: ROO_DIR, backup_path: ROO_BACKUP_DIR };
    configManager.save();
};

export const linkOpenclaw = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    console.log(chalk.green(`\nSetting up OpenClaw integration...`));
    console.log(chalk.dim(OPENCLAW_DIR));

    const openclawDirs = AGENT_PROMPT_DIRS[TOOLS.OPENCLAW];

    const backupExistingOpenclawFiles = async (): Promise<boolean> => {
        try {
            fs.mkdirSync(OPENCLAW_DIR, { recursive: true });

            const dirsToBackup: string[] = [];
            for (const dir of openclawDirs) {
                const target = path.join(OPENCLAW_DIR, dir);
                if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false) {
                    dirsToBackup.push(dir);
                }
            }

            if (dirsToBackup.length === 0) {
                return true;
            }

            fs.mkdirSync(OPENCLAW_BACKUP_DIR, { recursive: true });
            for (const dir of dirsToBackup) {
                const src = path.join(OPENCLAW_DIR, dir);
                const dest = path.join(OPENCLAW_BACKUP_DIR, dir);
                fs.renameSync(src, dest);
                console.log(chalk.dim(`  backed up: ${dir}/ → ${dest}`));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to backup existing directories: ${ex.message}`));
            return false;
        }
    };

    const setOpenclawAssets = async (): Promise<boolean> => {
        try {
            const linked: { dir: string; src: string }[] = [];

            for (const dir of openclawDirs) {
                const src = path.join(repoPath, dir);
                const dest = path.join(OPENCLAW_DIR, dir);

                if ((await pathExists(src)) === false) { continue; }

                if (fs.existsSync(dest)) {
                    fs.rmSync(dest, { recursive: true, force: true });
                }

                const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
                fs.symlinkSync(src, dest, symlinkType);
                linked.push({ dir, src });
            }

            for (const { dir, src } of linked) {
                const isLast = linked[linked.length - 1].dir === dir;
                const branch = isLast ? '└──' : '├──';
                console.log(chalk.dim(`  ${branch} `) + chalk.bold(`${dir}/`) + chalk.dim(` → ${src}`) + chalk.green(' ✓'));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to create symlinks: ${ex.message}`));
            return false;
        }
    };

    const backupOk = await backupExistingOpenclawFiles();
    if (backupOk === false) { return; }

    const linkOk = await setOpenclawAssets();
    if (linkOk === false) { return; }

    configManager.openclaw = { path: OPENCLAW_DIR, backup_path: OPENCLAW_BACKUP_DIR };
    configManager.save();
};

export const linkCodex = async (): Promise<void> => {
    if (resolveRepoPath() == null) { return; }
    console.log(chalk.yellow('Codex integration is not yet implemented.'));
};

// ─── Unlink ──────────────────────────────────────────────────────────────────

export const unlinkClaudeCode = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove Claude Code plugin dir (${CLAUDE_CODE_DIR}) and settings entries?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(claudeSettingsPath)) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${claudeSettingsPath}.bak.${timestamp}`;
            fs.copyFileSync(claudeSettingsPath, backupPath);

            const settings = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf-8'));
            if (settings?.extraKnownMarketplaces?.[PLUGIN_NAME] !== undefined) {
                delete settings.extraKnownMarketplaces[PLUGIN_NAME];
            }
            if (settings?.enabledPlugins?.[`${PLUGIN_NAME}@${PLUGIN_NAME}`] !== undefined) {
                delete settings.enabledPlugins[`${PLUGIN_NAME}@${PLUGIN_NAME}`];
            }

            try {
                fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
                fs.unlinkSync(backupPath);
                console.log(chalk.dim(`  removed set-prompt entries from: ${claudeSettingsPath}`));
            } catch (ex: any) {
                fs.copyFileSync(backupPath, claudeSettingsPath);
                fs.unlinkSync(backupPath);
                console.warn(chalk.yellow('  ⚠ Write failed — rolled back to original.'));
            }
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to clean up settings.json: ${ex.message}`));
        }
    }

    if (fs.existsSync(CLAUDE_CODE_DIR)) {
        fs.rmSync(CLAUDE_CODE_DIR, { recursive: true, force: true });
        console.log(chalk.dim(`  removed: ${CLAUDE_CODE_DIR}`));
    }

    configManager.claude_code = null;
    configManager.save();
};

export const unlinkRooCode = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove RooCode symlinks from ${ROO_DIR}?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    const backupPath = configManager.roocode?.backup_path ?? ROO_BACKUP_DIR;

    for (const dir of AGENT_PROMPT_DIRS[TOOLS.ROOCODE]) {
        const target = path.join(ROO_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.dim(`  removed symlink: ${target}`));
        }
    }

    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.ROOCODE]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(ROO_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.dim(`  restored: ${dir}/`));
            }
            fs.rmdirSync(backupPath);
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to restore RooCode backup: ${ex.message}`));
        }
    }

    configManager.roocode = null;
    configManager.save();
};

export const unlinkOpenclaw = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove OpenClaw symlinks from ${OPENCLAW_DIR}?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    const backupPath = configManager.openclaw?.backup_path ?? OPENCLAW_BACKUP_DIR;

    for (const dir of AGENT_PROMPT_DIRS[TOOLS.OPENCLAW]) {
        const target = path.join(OPENCLAW_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.dim(`  removed symlink: ${target}`));
        }
    }

    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.OPENCLAW]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(OPENCLAW_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.dim(`  restored: ${dir}/`));
            }
            fs.rmdirSync(backupPath);
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to restore OpenClaw backup: ${ex.message}`));
        }
    }

    configManager.openclaw = null;
    configManager.save();
};

export const unlinkAntigravity = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove Antigravity symlinks from ${ANTIGRAVITY_DIR}?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    const backupPath = configManager.antigravity?.backup_path ?? ANTIGRAVITY_BACKUP_DIR;

    for (const dir of AGENT_PROMPT_DIRS[TOOLS.ANTIGRAVITY]) {
        const target = path.join(ANTIGRAVITY_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.dim(`  removed symlink: ${target}`));
        }
    }

    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.ANTIGRAVITY]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(ANTIGRAVITY_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.dim(`  restored: ${dir}/`));
            }
            fs.rmdirSync(backupPath);
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to restore Antigravity backup: ${ex.message}`));
        }
    }

    configManager.antigravity = null;
    configManager.save();
};

export const linkAntigravity = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    console.log(chalk.green(`\nSetting up Antigravity integration...`));
    console.log(chalk.dim(ANTIGRAVITY_DIR));

    const antigravityDirs = AGENT_PROMPT_DIRS[TOOLS.ANTIGRAVITY];

    const backupExistingAntigravityFiles = async (): Promise<boolean> => {
        try {
            fs.mkdirSync(ANTIGRAVITY_DIR, { recursive: true });

            const dirsToBackup: string[] = [];
            for (const dir of antigravityDirs) {
                const target = path.join(ANTIGRAVITY_DIR, dir);
                if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false) {
                    dirsToBackup.push(dir);
                }
            }

            if (dirsToBackup.length === 0) {
                return true;
            }

            fs.mkdirSync(ANTIGRAVITY_BACKUP_DIR, { recursive: true });
            for (const dir of dirsToBackup) {
                const src = path.join(ANTIGRAVITY_DIR, dir);
                const dest = path.join(ANTIGRAVITY_BACKUP_DIR, dir);
                fs.renameSync(src, dest);
                console.log(chalk.dim(`  backed up: ${dir}/ → ${dest}`));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to backup existing directories: ${ex.message}`));
            return false;
        }
    };

    const setAntigravityAssets = async (): Promise<boolean> => {
        try {
            const linked: { dir: string; src: string }[] = [];

            for (const dir of antigravityDirs) {
                const src = path.join(repoPath, dir);
                const dest = path.join(ANTIGRAVITY_DIR, dir);

                if ((await pathExists(src)) === false) { continue; }

                if (fs.existsSync(dest)) {
                    fs.rmSync(dest, { recursive: true, force: true });
                }

                const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
                fs.symlinkSync(src, dest, symlinkType);
                linked.push({ dir, src });
            }

            for (const { dir, src } of linked) {
                const isLast = linked[linked.length - 1].dir === dir;
                const branch = isLast ? '└──' : '├──';
                console.log(chalk.dim(`  ${branch} `) + chalk.bold(`${dir}/`) + chalk.dim(` → ${src}`) + chalk.green(' ✓'));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to create symlinks: ${ex.message}`));
            return false;
        }
    };

    const backupOk = await backupExistingAntigravityFiles();
    if (backupOk === false) { return; }

    const linkOk = await setAntigravityAssets();
    if (linkOk === false) { return; }

    configManager.antigravity = { path: ANTIGRAVITY_DIR, backup_path: ANTIGRAVITY_BACKUP_DIR };
    configManager.save();
};

export const linkCommand = async (tool?: string): Promise<void> => {
    if (tool != null) {
        const known = ALL_AGENTS.some(a => a.value === tool);
        if (!known) {
            console.log(chalk.red(`Unknown vendor: ${tool}`));
            process.exit(1);
        }
        if (tool === TOOLS.CLAUDECODE)        { await linkClaudeCode(); }
        else if (tool === TOOLS.ROOCODE)      { await linkRooCode(); }
        else if (tool === TOOLS.OPENCLAW)     { await linkOpenclaw(); }
        else if (tool === TOOLS.CODEX)        { await linkCodex(); }
        else if (tool === TOOLS.ANTIGRAVITY)  { await linkAntigravity(); }
        return;
    }

    const prevLinked: Record<string, boolean> = {
        [TOOLS.CLAUDECODE]:  configManager.isClaudeCodeEnabled(),
        [TOOLS.ROOCODE]:     configManager.isRooCodeEnabled(),
        [TOOLS.OPENCLAW]:    configManager.isOpenclawEnabled(),
        [TOOLS.CODEX]:       configManager.isCodexEnabled(),
        [TOOLS.ANTIGRAVITY]: configManager.isAntigravityEnabled(),
    };

    const selected = await checkbox({
        message: 'Which AI agent do you want to integrate?',
        choices: ALL_AGENTS.map(a => ({
            name: prevLinked[a.value] ? `${a.name} ${chalk.dim('(applied)')}` : a.name,
            value: a.value,
            checked: prevLinked[a.value],
        })),
    });

    for (const a of ALL_AGENTS) {
        const was = prevLinked[a.value];
        const now = selected.includes(a.value);

        if (!was && now) {
            if (a.value === TOOLS.CLAUDECODE)        { await linkClaudeCode(); }
            else if (a.value === TOOLS.ROOCODE)      { await linkRooCode(); }
            else if (a.value === TOOLS.OPENCLAW)     { await linkOpenclaw(); }
            else if (a.value === TOOLS.CODEX)        { await linkCodex(); }
            else if (a.value === TOOLS.ANTIGRAVITY)  { await linkAntigravity(); }
        }
        if (was && !now) {
            if (a.value === TOOLS.CLAUDECODE)        { await unlinkClaudeCode(true); }
            else if (a.value === TOOLS.ROOCODE)      { await unlinkRooCode(true); }
            else if (a.value === TOOLS.OPENCLAW)     { await unlinkOpenclaw(true); }
            else if (a.value === TOOLS.ANTIGRAVITY)  { await unlinkAntigravity(true); }
        }
    }
};
