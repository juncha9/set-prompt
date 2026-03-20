import fs from 'fs';
import chalk from 'chalk';
import { HOME_DIR, CONFIG_PATH, TAB } from '@/_defs';
import { GlobalConfigSchema } from '@/_types';
import type { GlobalConfig, ClaudeCodeConfig, RoocodeConfig, OpenclawConfig } from '@/_types';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
export { HOME_DIR as GLOBAL_CONFIG_DIR, CONFIG_PATH as GLOBAL_CONFIG_PATH };

class ConfigManager {
    repo_path: string | null = null;
    remote_url: string | null = null;
    claude_code: ClaudeCodeConfig | null = null;
    roocode: RoocodeConfig | null = null;
    openclaw: OpenclawConfig | null = null;

    init(): void {
        this._loadFromDisk();

        if (this.repo_path != null) {
            console.log(chalk.dim(`Config loaded from ${CONFIG_PATH}`));
        }
    }

    save(config: GlobalConfig): boolean {
        try {
            fs.mkdirSync(HOME_DIR, { recursive: true });
            // Remove undefined values before stringifying to TOML to avoid errors
            const cleanConfig = JSON.parse(JSON.stringify(config));
            fs.writeFileSync(CONFIG_PATH, stringifyToml(cleanConfig), 'utf-8');

            this._assign(config);

            console.log('\n' + chalk.green(`Config saved at ${chalk.dim(CONFIG_PATH)}`));
            console.log(`${TAB}repo_path: ${chalk.dim(config.repo_path)}`);
            if (config.remote_url != null) {
                console.log(`${TAB}remote_url : ${chalk.dim(config.remote_url)}`);
            }
            return true;
        } catch (ex: any) {
            console.error(chalk.red(`Failed to save config at ${CONFIG_PATH}, `), ex.message);
            return false;
        }
    }

    reload(): void {
        this._loadFromDisk();
    }

    exists(): boolean {
        return fs.existsSync(CONFIG_PATH);
    }

    private _assign(config: GlobalConfig): void {
        this.repo_path  = config.repo_path;
        this.remote_url = config.remote_url;
        this.claude_code = config.claude_code;
        this.roocode    = config.roocode;
        this.openclaw   = config.openclaw;
    }

    private _loadFromDisk(): void {
        if (fs.existsSync(CONFIG_PATH) === false) {
            return;
        }
        try {
            const textData = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const jsonData = parseToml(textData);
            const config = GlobalConfigSchema.parse(jsonData);
            this._assign(config);
        } catch (ex: any) {
            console.error(chalk.red(`Failed to parse config at ${CONFIG_PATH}, `), ex.message);
        }
    }
}

export const configManager = new ConfigManager();

// 기존 함수 호환 API
export const getConfig = (): GlobalConfig | null => {
    if (configManager.repo_path == null) { return null; }

    return {
        repo_path:  configManager.repo_path,
        remote_url: configManager.remote_url,
        claude_code: configManager.claude_code,
        roocode:    configManager.roocode,
        openclaw:   configManager.openclaw,
    };
};
export const setConfig = (config: GlobalConfig): boolean => configManager.save(config);
export const isConfigExists = (): boolean => configManager.exists();
