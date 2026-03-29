import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { installCommand } from '@/commands/install-command';
import { linkCommand } from '@/commands/link-command';
import { uninstallCommand } from '@/commands/uninstall-command';
import { scaffoldCommand } from '@/commands/scaffold-command';
import { statusCommand } from '@/commands/status-command';
import { configManager } from '@/_libs/config';

// Graceful exit on Ctrl+C
process.on('SIGINT', () => {
    console.log(chalk.yellow('\nCancelled.'));
    process.exit(0);
});

// @inquirer/prompts throws ExitPromptError on Ctrl+C — treat as clean exit
process.on('unhandledRejection', (reason) => {
    if (reason instanceof Error && reason.name === 'ExitPromptError') {
        console.log(chalk.yellow('\nCancelled.'));
        process.exit(0);
    }
    // re-throw unexpected errors
    throw reason;
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

configManager.init();

const program = new Command();

const banner = chalk.cyan(figlet.textSync('Set-Prompt', { horizontalLayout: 'full' }));

program
    .name('set-prompt')
    .description(pkg.description)
    .version(pkg.version)
    .addHelpText('beforeAll', banner + '\n')
    .action(() => {
        program.help();
    });

program
    .command('install')
    .description(`📦 Clone a ${chalk.cyan('git repo')} into ${chalk.dim('~/.set-prompt/repo/')} and register it as your prompt source`)
    .argument('<url>', 'remote git URL')
    .action(async (source: string) => {
        await installCommand(source);
    });

program
    .command('link')
    .description(`🔗 Symlink your prompt repo into an ${chalk.cyan('AI agent')} plugin dir ${chalk.dim('(claude-code | roocode | openclaw)')}`)
    .argument('[agent]', `target agent ${chalk.dim('(omit for interactive selection)')}`)
    .action(async (agent?: string) => {
        await linkCommand(agent);
    });

program
    .command('scaffold')
    .description(`🛠️  Verify and create ${chalk.cyan('required directories')} in a prompt repo ${chalk.dim('(-f to force overwrite)')}`)
    .argument('[path]', `path to repo ${chalk.dim('(defaults to installed source)')}`)
    .option('-f, --force', 'overwrite existing files without prompting')
    .action(async (localPath?: string, options?: { force?: boolean }) => {
        await scaffoldCommand(localPath, options);
    });

program
    .command('status')
    .description(`📋 Show registered ${chalk.cyan('repo')} and which ${chalk.cyan('agents')} are linked`)
    .action(() => {
        statusCommand();
    });

program
    .command('uninstall')
    .description(`🗑️  Remove all set-prompt data ${chalk.dim('(~/.set-prompt/, plugin dirs, settings entries)')}`)
    .action(async () => {
        await uninstallCommand();
    });

program.parse(process.argv);
