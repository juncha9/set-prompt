import fs from 'fs';
import { parse, stringify } from 'smol-toml';
import chalk from 'chalk';
import { GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_PATH } from '@/_defs/index';
import type { GlobalConfig } from '@/_types/index';

export { GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_PATH };
export type { GlobalConfig };

export function readGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(GLOBAL_CONFIG_PATH)) {
    console.log(chalk.red('No prompt source registered.'));
    console.log(chalk.yellow('Run: set-prompt use <local-path or git-url>'));
    process.exit(1);
  }
  return parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8')) as unknown as GlobalConfig;
}
