import path from 'path';
import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { CLAUDE_CODE_DIR, MARKET_NAME, PLUGIN_NAME } from '@/_defs';
import { configManager } from '@/_libs/config';
import { resolveRepoPath } from '@/_libs';

export const linkClaudeCode = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    const buildMarketplace = (): boolean => {
        try {
            // marketplace.json
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
                JSON.stringify(marketplaceJson, null, 4),
                'utf-8',
            );
            console.log(chalk.dim('  ├── .claude-plugin/'));
            console.log(chalk.dim('  │   └── marketplace.json') + chalk.green(' ✓'));

            // plugins/sppt → repo symlink
            const pluginLink = path.join(CLAUDE_CODE_DIR, 'plugins', PLUGIN_NAME);
            fs.mkdirSync(path.dirname(pluginLink), { recursive: true });
            if (fs.existsSync(pluginLink)) {
                fs.rmSync(pluginLink, { recursive: true, force: true });
            }
            const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
            fs.symlinkSync(repoPath, pluginLink, symlinkType);
            console.log(chalk.dim('  └── plugins/'));
            console.log(chalk.dim(`      └── ${PLUGIN_NAME}/`) + chalk.dim(` → ${repoPath}`) + chalk.green(' ✓'));

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to build marketplace structure: ${ex.message}`));
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
                fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 4), 'utf-8');
            } catch (ex: any) {
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
        const installPath = repoPath;
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
            fs.writeFileSync(installedPluginsPath, JSON.stringify(data, null, 4), 'utf-8');
            console.log(`✅ Patched installed_plugins.json → installPath points to source.`);
            console.log(chalk.dim(`   ${installPath}`));
        } catch (ex: any) {
            console.warn(chalk.yellow(`  ⚠ Could not patch installed_plugins.json: ${ex.message}`));
        }
    };

    console.log(chalk.green(`\nSetting up Claude Code plugin...`));
    console.log(chalk.dim(CLAUDE_CODE_DIR));

    const marketplaceOk = buildMarketplace();
    if (marketplaceOk === false) { return; }

    const settingsOk = registerToClaudeSettings();
    if (settingsOk === false) { return; }

    patchInstalledPlugins();

    configManager.claude_code = { path: CLAUDE_CODE_DIR };
    configManager.save();
};

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
                fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 4), 'utf-8');
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
                fs.writeFileSync(installedPluginsPath, JSON.stringify(installed, null, 4), 'utf-8');
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
                fs.writeFileSync(knownMarketplacesPath, JSON.stringify(marketplaces, null, 4), 'utf-8');
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
