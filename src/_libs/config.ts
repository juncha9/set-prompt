import fs from 'fs';
import chalk from 'chalk';
import { HOME_DIR, CONFIG_PATH, TAB } from '@/_defs';
import { GlobalConfigSchema } from '@/_types';
import type { GlobalConfig, ClaudeCodeConfig, RoocodeConfig, OpenclawConfig } from '@/_types';
export { HOME_DIR as GLOBAL_CONFIG_DIR, CONFIG_PATH as GLOBAL_CONFIG_PATH };

class ConfigManager {
    private _repo_path:  string | null = null;
    private _remote_url: string | null = null;
    private _claude_code: ClaudeCodeConfig | null = null;
    private _roocode:    RoocodeConfig | null = null;
    private _openclaw:   OpenclawConfig | null = null;

    get repo_path()  { return this._repo_path; }
    get remote_url() { return this._remote_url; }
    get claude_code() { return this._claude_code; }
    get roocode()    { return this._roocode; }
    get openclaw()   { return this._openclaw; }

    set repo_path(v: string | null)            { this._repo_path  = v; }
    set remote_url(v: string | null)           { this._remote_url = v; }
    set claude_code(v: ClaudeCodeConfig | null) { this._claude_code = v; }
    set roocode(v: RoocodeConfig | null)       { this._roocode    = v; }
    set openclaw(v: OpenclawConfig | null)     { this._openclaw   = v; }

    init(): void {
        this._loadFromDisk();

        if (this._repo_path != null) {
            console.log(chalk.dim(`Config loaded from ${CONFIG_PATH}`));
        }
    }

    save(): boolean {
        if (this._repo_path == null) {
            console.error(chalk.red('Cannot save config: repo_path is not set.'));
            return false;
        }
        try {
            const config: GlobalConfig = {
                repo_path:   this._repo_path,
                remote_url:  this._remote_url,
                claude_code: this._claude_code,
                roocode:     this._roocode,
                openclaw:    this._openclaw,
            };
            fs.mkdirSync(HOME_DIR, { recursive: true });
            const configStr = JSON.stringify({
                repo_path:   this._repo_path,
                remote_url:  this._remote_url,
                claude_code: this._claude_code,
                roocode:     this._roocode,
                openclaw:    this._openclaw,
            }, null, 4);
            fs.writeFileSync(CONFIG_PATH, configStr, 'utf-8');

            console.log(chalk.green(`Config saved`) + chalk.dim(` → ${CONFIG_PATH}`));
            return true;
        } catch (ex: any) {
            console.error(chalk.red(`Failed to save config at '${CONFIG_PATH}'`), ex.message);
            return false;
        }
    }

    reload(): void {
        this._loadFromDisk();
    }

    exists(): boolean {
        return fs.existsSync(CONFIG_PATH);
    }

    isRepoSet(): boolean {
        return this._repo_path != null;
    }

    isClaudeCodeEnabled(): boolean {
        return this._claude_code != null;
    }

    isRooCodeEnabled(): boolean {   
        return this._roocode != null;
    }

    isOpenclawEnabled(): boolean {
        return this._openclaw != null;
    }

    private _assign(config: GlobalConfig): void {
        this._repo_path  = config.repo_path;
        this._remote_url = config.remote_url;
        this._claude_code = config.claude_code;
        this._roocode    = config.roocode;
        this._openclaw   = config.openclaw;
    }

    private _loadFromDisk(): void {
        if (fs.existsSync(CONFIG_PATH) === false) {
            return;
        }
        try {
            const textData = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const json = JSON.parse(textData);
            const config = GlobalConfigSchema.parse(json);
            this._assign(config);
        } catch (ex: any) {
            console.error(chalk.red(`Failed to parse config at '${CONFIG_PATH}'`), ex.message);
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
export const setConfig = (config: GlobalConfig): boolean => {
    configManager.repo_path  = config.repo_path;
    configManager.remote_url = config.remote_url;
    configManager.claude_code = config.claude_code;
    configManager.roocode    = config.roocode;
    configManager.openclaw   = config.openclaw;
    return configManager.save();
};
export const isConfigExists = (): boolean => configManager.exists();
