import fs from 'fs';
import { parse, stringify } from 'smol-toml';
import chalk from 'chalk';
import { HOME_DIR, CONFIG_PATH, TAB } from '@/_defs';
import { GlobalConfigSchema } from '@/_types';
import type { GlobalConfig } from '@/_types';
export { HOME_DIR as GLOBAL_CONFIG_DIR, CONFIG_PATH as GLOBAL_CONFIG_PATH };

export const setConfig = (config: GlobalConfig):boolean => {
    try {
        fs.mkdirSync(HOME_DIR, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, stringify(config as unknown as Record<string, unknown>), 'utf-8');

        console.log('\n' + chalk.green(`Config saved at ${chalk.dim(CONFIG_PATH)}`));
        console.log(`${TAB}repo_path: ${chalk.dim(config.repo_path)}`);
        if (config.remote_url != null) {
            console.log(`${TAB}remote_url : ${chalk.dim(config.remote_url)}`);
        }
        return true;
    }
    catch (ex:any) { 
        console.error(chalk.red(`Failed to save config at ${CONFIG_PATH}, `), ex.message);
        return false;
    }

}

export const getConfig = (): GlobalConfig | null => {
    if (fs.existsSync(CONFIG_PATH) == false) {
        return null;
    }

    try {
        const textData = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const _config = parse(textData);

        return GlobalConfigSchema.parse(_config);
    }
    catch (ex:any) {
        console.error(chalk.red(`Failed to parse config at ${CONFIG_PATH}, `), ex.message);
        return null;
    }
}
