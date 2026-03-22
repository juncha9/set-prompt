import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defaultCommand } from '@/commands/default-command';
import { loadCommand } from '@/commands/load-command';
import { useCommand } from '@/commands/use-command';
import { validateCommand } from '@/commands/validate-command';
import { unloadCommand } from '@/commands/unload-command';
import { checkCommand } from '@/commands/check-command';
import { configManager } from '@/_libs/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

configManager.init();

const program = new Command();

const banner = chalk.cyan(figlet.textSync('Set-Prompt', { horizontalLayout: 'full' }));

if (process.argv.length <= 2 || process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(banner);
}

program
    .name('set-prompt')
    .description(pkg.description)
    .version(pkg.version)
    .argument('<source>', 'Prompt repo: local path or remote git URL')
    .action(async (source: string) => {
        await defaultCommand(source);
    });

program
    .command('load')
    .description('Register prompt repo only (local path or remote git URL)')
    .argument('<source>', 'Prompt repo: local path or remote git URL')
    .action(async (source: string) => {
        await loadCommand(source);
    });

program
    .command('use')
    .description('Apply prompt source to AI agents')
    .argument('[agent]', 'claude-code | roocode | openclaw (omit for interactive)')
    .action(async (agent?: string) => {
        await useCommand(agent);
    });

program
    .command('validate')
    .description('Check repo directory structure (skills/, commands/, hooks/)')
    .argument('[local-path]', 'Path to the prompt repo (overrides config)')
    .action(async (localPath?: string) => {
        await validateCommand(localPath);
    });

program
    .command('check')
    .description('Initialize repo structure (SET_PROMPT_GUIDE.md, skills/, commands/, ...)')
    .argument('[path]', 'Path to the prompt repo (defaults to current directory)')
    .option('-f, --force', 'Skip confirmation and overwrite existing files')
    .action(async (localPath?: string, options?: { force?: boolean }) => {
        if(localPath == null) {
            console.error(chalk.red('Path is required for check command. Please provide a path to initialize the repo structure.'));
            process.exit(1);
            return;
        }

        if(fs.statSync(localPath).isDirectory() === false) {
            console.error(chalk.red(`Please provide a valid directory path. [${localPath}]`));
            process.exit(1);
            return;
        }

        await checkCommand(localPath, options);
    });

program
    .command('unload')
    .description('Remove all set-prompt data (config, Claude Code plugin dir, home dir)')
    .action(async () => {
        await unloadCommand();
    });

program.parse(process.argv);
