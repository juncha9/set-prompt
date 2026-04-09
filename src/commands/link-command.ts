import path from 'path';
import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import { confirm, checkbox } from '@inquirer/prompts';
import { pathExists } from 'fs-extra';
import { CLAUDE_CODE_DIR, ROO_DIR, ROO_BACKUP_DIR, OPENCLAW_DIR, OPENCLAW_BACKUP_DIR, ANTIGRAVITY_DIR, ANTIGRAVITY_BACKUP_DIR, CODEX_DIR, CODEX_BACKUP_DIR, CURSOR_DIR, CURSOR_PLUGIN_DIR, AGENT_PROMPT_DIRS, ALL_AGENTS, TOOLS } from '@/_defs';
import { configManager } from '@/_libs/config';

const resolveRepoPath = (): string | null => {
    if (configManager.repo_path == null) {
        console.error(chalk.red('❌ No repo installed.'));
        console.log(chalk.yellow('Run: set-prompt install <git-url>'));
        return null;
    }
    return configManager.repo_path;
};

const MARKET_NAME = 'set-prompt';
const PLUGIN_NAME = 'sppt';

export const linkClaudeCode = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    const setClaudeCodeAssets = async (): Promise<boolean> => {
        try {
            fs.mkdirSync(CLAUDE_CODE_DIR, { recursive: true });

            const marketplaceMetaDir = path.join(CLAUDE_CODE_DIR, '.claude-plugin');
            fs.mkdirSync(marketplaceMetaDir, { recursive: true });
            const marketplaceJson = {
                name: MARKET_NAME,
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
                [MARKET_NAME]: { source: { source: 'directory', path: CLAUDE_CODE_DIR } },
            };
            settings.enabledPlugins = {
                ...settings.enabledPlugins,
                [`${PLUGIN_NAME}@${MARKET_NAME}`]: true,
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

    const patchInstalledPlugins = (): void => {
        const installPath = path.join(CLAUDE_CODE_DIR, 'plugins', PLUGIN_NAME);
        const installedPluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
        const pluginKey = `${PLUGIN_NAME}@${MARKET_NAME}`;
        try {
            let data: Record<string, any> = { version: 2, plugins: {} };
            if (fs.existsSync(installedPluginsPath)) {
                try { data = JSON.parse(fs.readFileSync(installedPluginsPath, 'utf-8')); } catch { /* use default */ }
            }
            if (data.plugins == null) { data.plugins = {}; }

            data.plugins[pluginKey] = [
                {
                    scope: 'user',
                    installPath,
                    version: '1.0.0',
                    installedAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                },
            ];

            fs.mkdirSync(path.dirname(installedPluginsPath), { recursive: true });
            fs.writeFileSync(installedPluginsPath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`✅ Patched installed_plugins.json → installPath points to source.`);
            console.log(chalk.dim(`   ${installPath}`));
        } catch (ex: any) {
            console.warn(chalk.yellow(`  ⚠ Could not patch installed_plugins.json: ${ex.message}`));
        }
    };

    console.log(chalk.green(`\nSetting up Claude Code plugin...`));
    console.log(chalk.dim(CLAUDE_CODE_DIR));

    const structureOk = await setClaudeCodeAssets();
    if (structureOk === false) { return; }

    const settingsOk = registerToClaudeSettings();
    if (settingsOk === false) { return; }

    patchInstalledPlugins();

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
                if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false && fs.readdirSync(target).length > 0) {
                    dirsToBackup.push(dir);
                }
            }

            if (dirsToBackup.length === 0) {
                return true;
            }

            console.log(chalk.yellow(`\n  ⚠ The following existing directories will be replaced by symlinks:`));
            for (const dir of dirsToBackup) {
                console.log(chalk.dim(`    - ${path.join(ROO_DIR, dir)}`));
            }
            console.log(chalk.yellow(`  They will be backed up to: `) + chalk.dim(ROO_BACKUP_DIR));

            const ok = await confirm({ message: 'Back up existing directories?', default: true });
            if (!ok) {
                console.log(chalk.yellow('Skipped RooCode linking.'));
                return false;
            }

            fs.mkdirSync(ROO_BACKUP_DIR, { recursive: true });
            for (const dir of dirsToBackup) {
                const src = path.join(ROO_DIR, dir);
                const dest = path.join(ROO_BACKUP_DIR, dir);
                fs.renameSync(src, dest);
                console.log(chalk.yellow('  backed up') + chalk.dim(`: ${dir}/ → ${dest}`));
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
                if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false && fs.readdirSync(target).length > 0) {
                    dirsToBackup.push(dir);
                }
            }

            if (dirsToBackup.length === 0) {
                return true;
            }

            console.log(chalk.yellow(`\n  ⚠ The following existing directories will be replaced by symlinks:`));
            for (const dir of dirsToBackup) {
                console.log(chalk.dim(`    - ${path.join(OPENCLAW_DIR, dir)}`));
            }
            console.log(chalk.yellow(`  They will be backed up to: `) + chalk.dim(OPENCLAW_BACKUP_DIR));

            const ok = await confirm({ message: 'Back up existing directories?', default: true });
            if (!ok) {
                console.log(chalk.yellow('Skipped OpenClaw linking.'));
                return false;
            }

            fs.mkdirSync(OPENCLAW_BACKUP_DIR, { recursive: true });
            for (const dir of dirsToBackup) {
                const src = path.join(OPENCLAW_DIR, dir);
                const dest = path.join(OPENCLAW_BACKUP_DIR, dir);
                fs.renameSync(src, dest);
                console.log(chalk.yellow('  backed up') + chalk.dim(`: ${dir}/ → ${dest}`));
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
                if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false && fs.readdirSync(target).length > 0) {
                    dirsToBackup.push(dir);
                }
            }

            if (dirsToBackup.length === 0) {
                return true;
            }

            console.log(chalk.yellow(`\n  ⚠ The following existing directories will be replaced by symlinks:`));
            for (const dir of dirsToBackup) {
                console.log(chalk.dim(`    - ${path.join(ANTIGRAVITY_DIR, dir)}`));
            }
            console.log(chalk.yellow(`  They will be backed up to: `) + chalk.dim(ANTIGRAVITY_BACKUP_DIR));

            const ok = await confirm({ message: 'Back up existing directories?', default: true });
            if (!ok) {
                console.log(chalk.yellow('Skipped Antigravity linking.'));
                return false;
            }

            fs.mkdirSync(ANTIGRAVITY_BACKUP_DIR, { recursive: true });
            for (const dir of antigravityDirs) {
                const src = path.join(ANTIGRAVITY_DIR, dir);
                const dest = path.join(ANTIGRAVITY_BACKUP_DIR, dir);
                fs.renameSync(src, dest);
                console.log(chalk.yellow('  backed up') + chalk.dim(`: ${dir}/ → ${dest}`));
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


export const linkCodex = async (): Promise<void> => {
    // TODO: re-enable in next release
    console.error(chalk.red('❌ Codex integration is not available in this version.'));
    return;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _linkCodexImpl = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    console.log(chalk.green(`\nSetting up Codex integration...`));
    console.log(chalk.dim(CODEX_DIR));

    const codexDirs = AGENT_PROMPT_DIRS[TOOLS.CODEX];

    const backupExistingCodexFiles = async (): Promise<boolean> => {
        try {
            fs.mkdirSync(CODEX_DIR, { recursive: true });

            const dirsToBackup: string[] = [];
            for (const dir of codexDirs) {
                const target = path.join(CODEX_DIR, dir);
                if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false && fs.readdirSync(target).length > 0) {
                    dirsToBackup.push(dir);
                }
            }

            if (dirsToBackup.length === 0) {
                return true;
            }

            console.log(chalk.yellow(`\n  ⚠ The following existing directories will be replaced by symlinks:`));
            for (const dir of dirsToBackup) {
                console.log(chalk.dim(`    - ${path.join(CODEX_DIR, dir)}`));
            }
            console.log(chalk.yellow(`  They will be backed up to: `) + chalk.dim(CODEX_BACKUP_DIR));

            const ok = await confirm({ message: 'Back up existing directories?', default: true });
            if (!ok) {
                console.log(chalk.yellow('Skipped Codex linking.'));
                return false;
            }

            fs.mkdirSync(CODEX_BACKUP_DIR, { recursive: true });
            for (const dir of dirsToBackup) {
                const src = path.join(CODEX_DIR, dir);
                const dest = path.join(CODEX_BACKUP_DIR, dir);
                fs.renameSync(src, dest);
                console.log(chalk.yellow('  backed up') + chalk.dim(`: ${dir}/ → ${dest}`));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to backup existing directories: ${ex.message}`));
            return false;
        }
    };

    const setCodexAssets = async (): Promise<boolean> => {
        try {
            const linked: { dir: string; src: string }[] = [];

            for (const dir of codexDirs) {
                const src = path.join(repoPath, dir);
                const dest = path.join(CODEX_DIR, dir);

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

    const backupOk = await backupExistingCodexFiles();
    if (backupOk === false) { return; }

    const linkOk = await setCodexAssets();
    if (linkOk === false) { return; }

    configManager.codex = { path: CODEX_DIR, backup_path: CODEX_BACKUP_DIR };
    configManager.save();
};

export const linkCursor = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    const CURSOR_LOCAL_DIR = 'local';
    const CURSOR_PLUGIN_NAME = 'set-prompt';

    const setCursorAssets = async (): Promise<boolean> => {
        try {
            // 마켓플레이스 메타 디렉토리 생성
            const marketplaceMetaDir = path.join(CURSOR_DIR, '.cursor-plugin');
            fs.mkdirSync(marketplaceMetaDir, { recursive: true });
            const marketplaceJson = {
                name: CURSOR_PLUGIN_NAME,
                owner: { name: os.userInfo().username },
                metadata: { description: 'Managed by set-prompt' },
                plugins: [{ name: CURSOR_PLUGIN_NAME, source: `./plugins/${CURSOR_LOCAL_DIR}/${CURSOR_PLUGIN_NAME}`, description: 'Managed by set-prompt' }],
            };
            fs.writeFileSync(
                path.join(marketplaceMetaDir, 'marketplace.json'),
                JSON.stringify(marketplaceJson, null, 2),
                'utf-8',
            );
            console.log(chalk.dim('  ├── .cursor-plugin/'));
            console.log(chalk.dim('  │   └── marketplace.json') + chalk.green(' ✓'));

            // 플러그인 디렉토리 및 plugin.json 생성
            const pluginDir = path.join(CURSOR_DIR, 'plugins', CURSOR_LOCAL_DIR, CURSOR_PLUGIN_NAME);
            const pluginMetaDir = path.join(pluginDir, '.cursor-plugin');
            fs.mkdirSync(pluginMetaDir, { recursive: true });
            const cursorDirs = AGENT_PROMPT_DIRS[TOOLS.CURSOR];
            const pluginJson: Record<string, string> = {
                name: CURSOR_PLUGIN_NAME,
                displayName: 'set-prompt',
                version: '1.0.0',
                description: 'Managed by set-prompt',
            };
            for (const dir of cursorDirs) {
                pluginJson[dir] = `./${dir}/`;
            }
            fs.writeFileSync(
                path.join(pluginMetaDir, 'plugin.json'),
                JSON.stringify(pluginJson, null, 2),
                'utf-8',
            );
            console.log(chalk.dim('  └── plugins/'));
            console.log(chalk.dim(`      └── ${CURSOR_PLUGIN_NAME}/`));
            console.log(chalk.dim('          ├── .cursor-plugin/'));
            console.log(chalk.dim('          │   └── plugin.json') + chalk.green(' ✓'));

            // skills / agents / rules 심볼릭 링크
            const linked: { dir: string; src: string }[] = [];
            for (const dir of cursorDirs) {
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

            // ~/.cursor/plugins/set-prompt/ → pluginDir 심볼릭 링크 (broken symlink 포함 제거)
            fs.rmSync(CURSOR_PLUGIN_DIR, { recursive: true, force: true });
            fs.mkdirSync(path.dirname(CURSOR_PLUGIN_DIR), { recursive: true });
            const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
            fs.symlinkSync(pluginDir, CURSOR_PLUGIN_DIR, symlinkType);
            console.log(chalk.green(`\n✅ Installed to Cursor plugins.`));
            console.log(chalk.dim(`   ${CURSOR_PLUGIN_DIR}`));

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to build Cursor plugin structure: ${ex.message}`));
            return false;
        }
    };

    console.log(chalk.green(`\nSetting up Cursor plugin...`));
    console.log(chalk.dim(CURSOR_DIR));

    const structureOk = await setCursorAssets();
    if (structureOk === false) { return; }

    configManager.cursor = { path: CURSOR_DIR, plugin_dir: CURSOR_PLUGIN_DIR };
    configManager.save();
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

    console.log(chalk.red(`\nRemoving Claude Code plugin...`));
    console.log(chalk.dim(CLAUDE_CODE_DIR));

    const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(claudeSettingsPath)) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${claudeSettingsPath}.bak.${timestamp}`;
            fs.copyFileSync(claudeSettingsPath, backupPath);

            const settings = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf-8'));
            if (settings?.extraKnownMarketplaces?.[MARKET_NAME] !== undefined) {
                delete settings.extraKnownMarketplaces[MARKET_NAME];
            }
            if (settings?.enabledPlugins?.[`${PLUGIN_NAME}@${MARKET_NAME}`] !== undefined) {
                delete settings.enabledPlugins[`${PLUGIN_NAME}@${MARKET_NAME}`];
            }

            try {
                fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
                fs.unlinkSync(backupPath);
                console.log(chalk.red('  removed') + chalk.dim(` set-prompt entries from: ${claudeSettingsPath}`));
            } catch (ex: any) {
                fs.copyFileSync(backupPath, claudeSettingsPath);
                fs.unlinkSync(backupPath);
                console.warn(chalk.yellow('  ⚠ Write failed — rolled back to original.'));
            }
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to clean up settings.json: ${ex.message}`));
        }
    }

    const claudePluginsDir = path.join(os.homedir(), '.claude', 'plugins');

    const installedPluginsPath = path.join(claudePluginsDir, 'installed_plugins.json');
    if (fs.existsSync(installedPluginsPath)) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${installedPluginsPath}.bak.${timestamp}`;
            fs.copyFileSync(installedPluginsPath, backupPath);

            const installed = JSON.parse(fs.readFileSync(installedPluginsPath, 'utf-8'));
            if (installed?.plugins && typeof installed.plugins === 'object') {
                for (const key of Object.keys(installed.plugins)) {
                    if (key.endsWith(`@${MARKET_NAME}`)) {
                        delete installed.plugins[key];
                    }
                }
            }

            try {
                fs.writeFileSync(installedPluginsPath, JSON.stringify(installed, null, 2), 'utf-8');
                fs.unlinkSync(backupPath);
                console.log(chalk.red('  removed') + chalk.dim(` set-prompt entries from: ${installedPluginsPath}`));
            } catch (ex: any) {
                fs.copyFileSync(backupPath, installedPluginsPath);
                fs.unlinkSync(backupPath);
                console.warn(chalk.yellow('  ⚠ Write failed — rolled back installed_plugins.json.'));
            }
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to clean up installed_plugins.json: ${ex.message}`));
        }
    }

    const knownMarketplacesPath = path.join(claudePluginsDir, 'known_marketplaces.json');
    if (fs.existsSync(knownMarketplacesPath)) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${knownMarketplacesPath}.bak.${timestamp}`;
            fs.copyFileSync(knownMarketplacesPath, backupPath);

            const marketplaces = JSON.parse(fs.readFileSync(knownMarketplacesPath, 'utf-8'));
            if (marketplaces?.[MARKET_NAME] !== undefined) {
                delete marketplaces[MARKET_NAME];
            }

            try {
                fs.writeFileSync(knownMarketplacesPath, JSON.stringify(marketplaces, null, 2), 'utf-8');
                fs.unlinkSync(backupPath);
                console.log(chalk.red('  removed') + chalk.dim(` set-prompt entry from: ${knownMarketplacesPath}`));
            } catch (ex: any) {
                fs.copyFileSync(backupPath, knownMarketplacesPath);
                fs.unlinkSync(backupPath);
                console.warn(chalk.yellow('  ⚠ Write failed — rolled back known_marketplaces.json.'));
            }
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to clean up known_marketplaces.json: ${ex.message}`));
        }
    }

    if (fs.existsSync(CLAUDE_CODE_DIR)) {
        fs.rmSync(CLAUDE_CODE_DIR, { recursive: true, force: true });
        console.log(chalk.red('  removed') + chalk.dim(`: ${CLAUDE_CODE_DIR}`));
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

    console.log(chalk.red(`\nRemoving RooCode integration...`));
    console.log(chalk.dim(ROO_DIR));

    const backupPath = configManager.roocode?.backup_path ?? ROO_BACKUP_DIR;

    for (const dir of AGENT_PROMPT_DIRS[TOOLS.ROOCODE]) {
        const target = path.join(ROO_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.red('  removed symlink') + chalk.dim(`: ${target}`));
        }
    }

    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.ROOCODE]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(ROO_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.green('  restored') + chalk.dim(`: ${dir}/`));
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

    console.log(chalk.red(`\nRemoving OpenClaw integration...`));
    console.log(chalk.dim(OPENCLAW_DIR));

    const backupPath = configManager.openclaw?.backup_path ?? OPENCLAW_BACKUP_DIR;

    for (const dir of AGENT_PROMPT_DIRS[TOOLS.OPENCLAW]) {
        const target = path.join(OPENCLAW_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.red('  removed symlink') + chalk.dim(`: ${target}`));
        }
    }

    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.OPENCLAW]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(OPENCLAW_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.green('  restored') + chalk.dim(`: ${dir}/`));
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

    console.log(chalk.red(`\nRemoving Antigravity integration...`));
    console.log(chalk.dim(ANTIGRAVITY_DIR));

    const backupPath = configManager.antigravity?.backup_path ?? ANTIGRAVITY_BACKUP_DIR;

    for (const dir of AGENT_PROMPT_DIRS[TOOLS.ANTIGRAVITY]) {
        const target = path.join(ANTIGRAVITY_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.red('  removed symlink') + chalk.dim(`: ${target}`));
        }
    }

    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.ANTIGRAVITY]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(ANTIGRAVITY_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.green('  restored') + chalk.dim(`: ${dir}/`));
            }
            fs.rmdirSync(backupPath);
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to restore Antigravity backup: ${ex.message}`));
        }
    }

    configManager.antigravity = null;
    configManager.save();
};


export const unlinkCodex = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove Codex symlinks from ${CODEX_DIR}?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    console.log(chalk.red(`\nRemoving Codex integration...`));
    console.log(chalk.dim(CODEX_DIR));

    const backupPath = configManager.codex?.backup_path ?? CODEX_BACKUP_DIR;

    for (const dir of AGENT_PROMPT_DIRS[TOOLS.CODEX]) {
        const target = path.join(CODEX_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.red('  removed symlink') + chalk.dim(`: ${target}`));
        }
    }

    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.CODEX]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(CODEX_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.green('  restored') + chalk.dim(`: ${dir}/`));
            }
            fs.rmdirSync(backupPath);
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to restore Codex backup: ${ex.message}`));
        }
    }

    configManager.codex = null;
    configManager.save();
};

export const unlinkCursor = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove Cursor plugin dir (${CURSOR_PLUGIN_DIR}) and plugin structure?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    console.log(chalk.red(`\nRemoving Cursor plugin...`));
    console.log(chalk.dim(CURSOR_PLUGIN_DIR));

    // ~/.cursor/plugins/set-prompt 심볼릭 링크 제거 (broken symlink 포함)
    fs.rmSync(CURSOR_PLUGIN_DIR, { recursive: true, force: true });
    console.log(chalk.red('  removed') + chalk.dim(`: ${CURSOR_PLUGIN_DIR}`));

    // ~/.set-prompt/cursor 플러그인 구조 제거
    if (fs.existsSync(CURSOR_DIR)) {
        fs.rmSync(CURSOR_DIR, { recursive: true, force: true });
        console.log(chalk.red('  removed') + chalk.dim(`: ${CURSOR_DIR}`));
    }

    configManager.cursor = null;
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
        else if (tool === TOOLS.CURSOR)       { await linkCursor(); }
        return;
    }

    const prevLinked: Record<string, boolean> = {
        [TOOLS.CLAUDECODE]:  configManager.isClaudeCodeEnabled(),
        [TOOLS.ROOCODE]:     configManager.isRooCodeEnabled(),
        [TOOLS.OPENCLAW]:    configManager.isOpenclawEnabled(),
        [TOOLS.CODEX]:       configManager.isCodexEnabled(),
        [TOOLS.ANTIGRAVITY]: configManager.isAntigravityEnabled(),
        [TOOLS.CURSOR]:      configManager.isCursorEnabled(),
    };

    const selected = await checkbox({
        message: 'Which AI agent do you want to integrate?',
        choices: ALL_AGENTS.map(a => ({
            name: prevLinked[a.value] ? `${a.name} ${chalk.dim('(applied)')}` : a.name,
            value: a.value,
            checked: prevLinked[a.value],
        })),
    });

    const toLink   = ALL_AGENTS.filter(a => !prevLinked[a.value] &&  selected.includes(a.value));
    const toUnlink = ALL_AGENTS.filter(a =>  prevLinked[a.value] && !selected.includes(a.value));

    console.log();
    if (toLink.length > 0)   { console.log(chalk.green('  Link   ') + chalk.dim('→ ') + toLink.map(a => chalk.bold(a.name)).join(chalk.dim(', '))); }
    if (toUnlink.length > 0) { console.log(chalk.red('  Unlink ') + chalk.dim('→ ') + toUnlink.map(a => chalk.bold(a.name)).join(chalk.dim(', '))); }
    console.log();

    if (toLink.length === 0 && toUnlink.length === 0) { return; }

    for (const a of ALL_AGENTS) {
        const was = prevLinked[a.value];
        const now = selected.includes(a.value);

        if (!was && now) {
            if (a.value === TOOLS.CLAUDECODE)        { await linkClaudeCode(); }
            else if (a.value === TOOLS.ROOCODE)      { await linkRooCode(); }
            else if (a.value === TOOLS.OPENCLAW)     { await linkOpenclaw(); }
            else if (a.value === TOOLS.CODEX)        { await linkCodex(); }
            else if (a.value === TOOLS.ANTIGRAVITY)  { await linkAntigravity(); }
            else if (a.value === TOOLS.CURSOR)       { await linkCursor(); }
        }
        if (was && !now) {
            if (a.value === TOOLS.CLAUDECODE)        { await unlinkClaudeCode(true); }
            else if (a.value === TOOLS.ROOCODE)      { await unlinkRooCode(true); }
            else if (a.value === TOOLS.OPENCLAW)     { await unlinkOpenclaw(true); }
            else if (a.value === TOOLS.CODEX)        { await unlinkCodex(true); }
            else if (a.value === TOOLS.ANTIGRAVITY)  { await unlinkAntigravity(true); }
            else if (a.value === TOOLS.CURSOR)       { await unlinkCursor(true); }
        }
    }
};
