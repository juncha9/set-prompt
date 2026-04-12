import path from 'path';
import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import TOML from 'smol-toml';
import { CODEX_DIR, PLUGIN_NAME } from '@/_defs';
import { configManager } from '@/_libs/config';
import { resolveRepoPath } from '@/_libs';
import { ensureCodexPluginManifest, ensureMcpJson, ensureAppJson } from '@/commands/scaffold-command';

const CODEX_AGENTS_DIR = path.join(os.homedir(), '.agents', 'plugins');
const CODEX_CACHE_DIR = path.join(os.homedir(), '.codex', 'plugins', 'cache');
const CODEX_MARKETPLACE_NAME = 'local-repo';

export const linkCodex = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    // ── 0. repo에 플러그인 필수 파일 보장 ──────────────────────────────
    ensureCodexPluginManifest(repoPath);
    ensureMcpJson(repoPath);
    ensureAppJson(repoPath);

    // ── 1. marketplace.json 등록 ────────────────────────────────────────
    const registerToMarketplace = (): boolean => {
        const marketplacePath = path.join(CODEX_AGENTS_DIR, 'marketplace.json');
        try {
            let marketplace: Record<string, any> = {
                name: CODEX_MARKETPLACE_NAME,
                interface: { displayName: 'Local Repository' },
                plugins: [],
            };

            if (fs.existsSync(marketplacePath)) {
                const raw = fs.readFileSync(marketplacePath, 'utf-8');
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        marketplace = parsed;
                    }
                } catch {
                    console.warn(chalk.yellow('  ⚠ Failed to parse marketplace.json — will not overwrite existing file'));
                    console.error(chalk.red('❌ Could not register plugin. Please add manually.'));
                    return false;
                }
            }

            if (!Array.isArray(marketplace.plugins)) {
                marketplace.plugins = [];
            }
            marketplace.plugins = marketplace.plugins.filter(
                (p: any) => p?.name !== PLUGIN_NAME,
            );
            const relRepoPath = `./${path.relative(os.homedir(), repoPath).replace(/\\/g, '/')}`;
            marketplace.plugins.push({
                name: PLUGIN_NAME,
                source: {
                    source: 'local',
                    path: relRepoPath,
                }, 
                policy: {
                    installation: 'AVAILABLE',
                },
                category: 'Productivity',
            });

            let backupPath: string | null = null;
            if (fs.existsSync(marketplacePath)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                backupPath = `${marketplacePath}.bak.${timestamp}`;
                try {
                    fs.copyFileSync(marketplacePath, backupPath);
                } catch (ex: any) {
                    console.warn(chalk.yellow(`  ⚠ Could not create backup: ${ex.message}`));
                    backupPath = null;
                }
            }

            try {
                fs.mkdirSync(path.dirname(marketplacePath), { recursive: true });
                fs.writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 4), 'utf-8');
            } catch (ex: any) {
                if (backupPath !== null) {
                    try {
                        fs.copyFileSync(backupPath, marketplacePath);
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

            console.log(`✅ Registered to marketplace.json`);
            console.log(chalk.dim(`   ${marketplacePath}`));

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to update marketplace.json: ${ex.message}`));
            return false;
        }
    };

    // ── 3. plugin cache 패치 ────────────────────────────────────────────
    const patchPluginCache = (): void => {
        const cachePath = path.join(CODEX_CACHE_DIR, CODEX_MARKETPLACE_NAME, PLUGIN_NAME, '1.0.0');
        try {
            fs.mkdirSync(path.dirname(cachePath), { recursive: true });
            if (fs.existsSync(cachePath)) {
                fs.rmSync(cachePath, { recursive: true, force: true });
            }
            const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
            fs.symlinkSync(repoPath, cachePath, symlinkType);
            console.log(`✅ Patched plugin cache.`);
            console.log(chalk.dim(`   ${cachePath}`) + chalk.dim(' → ') + chalk.dim(repoPath));
        } catch (ex: any) {
            console.warn(chalk.yellow(`  ⚠ Could not patch plugin cache: ${ex.message}`));
        }
    };

    // ── 4. config.toml 활성화 ───────────────────────────────────────────
    const enableInConfig = (): void => {
        const configPath = path.join(os.homedir(), '.codex', 'config.toml');
        const pluginKey = `${PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`;
        try {
            let config: Record<string, any> = {};
            if (fs.existsSync(configPath)) {
                config = TOML.parse(fs.readFileSync(configPath, 'utf-8'));
            }
            if (config.plugins == null) { config.plugins = {}; }
            config.plugins[pluginKey] = { enabled: true };
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, TOML.stringify(config), 'utf-8');
            console.log(`✅ Enabled plugin in config.toml`);
            console.log(chalk.dim(`   ${configPath}`));
        } catch (ex: any) {
            console.warn(chalk.yellow(`  ⚠ Could not update config.toml: ${ex.message}`));
        }
    };

    console.log(chalk.green(`\nSetting up Codex plugin...`));

    const marketplaceOk = registerToMarketplace();
    if (marketplaceOk === false) { return; }

    patchPluginCache();
    enableInConfig();

    configManager.codex = { path: CODEX_DIR };
    configManager.save();
};

export const unlinkCodex = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove Codex plugin and marketplace entries?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    console.log(chalk.red(`\nRemoving Codex plugin...`));

    // marketplace.json에서 플러그인 엔트리 제거
    const marketplacePath = path.join(CODEX_AGENTS_DIR, 'marketplace.json');
    if (fs.existsSync(marketplacePath)) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${marketplacePath}.bak.${timestamp}`;
            fs.copyFileSync(marketplacePath, backupPath);

            const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf-8'));
            if (Array.isArray(marketplace?.plugins)) {
                marketplace.plugins = marketplace.plugins.filter(
                    (p: any) => p?.name !== PLUGIN_NAME,
                );
            }

            try {
                fs.writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 4), 'utf-8');
                fs.unlinkSync(backupPath);
                console.log(chalk.red('  removed') + chalk.dim(` ${PLUGIN_NAME} from: ${marketplacePath}`));
            } catch (ex: any) {
                fs.copyFileSync(backupPath, marketplacePath);
                fs.unlinkSync(backupPath);
                console.warn(chalk.yellow('  ⚠ Write failed — rolled back to original.'));
            }
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to clean up marketplace.json: ${ex.message}`));
        }
    }

    // config.toml에서 플러그인 제거
    const configPath = path.join(os.homedir(), '.codex', 'config.toml');
    if (fs.existsSync(configPath)) {
        try {
            const config = TOML.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, any>;
            const pluginKey = `${PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`;
            if (config.plugins?.[pluginKey] !== undefined) {
                delete config.plugins[pluginKey];
                fs.writeFileSync(configPath, TOML.stringify(config), 'utf-8');
                console.log(chalk.red('  removed') + chalk.dim(` ${pluginKey} from: ${configPath}`));
            }
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to clean up config.toml: ${ex.message}`));
        }
    }

    // cache 제거
    const cacheMarketDir = path.join(CODEX_CACHE_DIR, CODEX_MARKETPLACE_NAME);
    if (fs.existsSync(cacheMarketDir)) {
        fs.rmSync(cacheMarketDir, { recursive: true, force: true });
        console.log(chalk.red('  removed') + chalk.dim(`: ${cacheMarketDir}`));
    }

    configManager.codex = null;
    configManager.save();
};
