import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkbox } from '@inquirer/prompts';
import { loadCommand } from '@/commands/load-command';
import { useClaudeCode, useRoocode, useOpenclaw } from '@/commands/use-command';
import { validateCommand } from '@/commands/validate-command';
import { unloadCommand } from '@/commands/unload-command';
import { getConfig } from '@/_libs/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

const banner = chalk.cyan(figlet.textSync('Set-Prompt', { horizontalLayout: 'full' }));

if (process.argv.length <= 2 || process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(banner);
}

program
    .name('set-prompt')
    .description(pkg.description)
    .version(pkg.version)
    .argument('[source]', 'Prompt repo: local path or remote git URL')
    .action(async (source?: string) => {
        if (!source) {
            console.log(chalk.red('Error: source is required.'));
            console.log(chalk.yellow('Usage: set-prompt <local-path or git-url>'));
            process.exit(1);
        }

        await loadCommand(source);
        const config = getConfig();
        if (config == null) {
            console.log(chalk.red('No prompt source registered.'));
            console.log(chalk.yellow('Run: set-prompt <local-path or git-url>'));
            process.exit(1);
        }

        const agents = await checkbox({
            message: 'Which AI agent do you want to integrate?',
            choices: [
                { name: 'Claude Code', value: 'claude-code' },
                { name: 'RooCode', value: 'roocode' },
                { name: 'OpenClaw', value: 'openclaw' },
            ],
        });

        if (agents.length === 0) {
            console.log(chalk.yellow('No agent selected. Exiting.'));
            return;
        }

        for (const agent of agents) {
            if (agent === 'claude-code') await useClaudeCode();
            else if (agent === 'roocode') await useRoocode();
            else if (agent === 'openclaw') await useOpenclaw();
        }
    });

program
    .command('use')
    .description('Apply prompt source to AI agents')
    .argument('[agent]', 'claude-code | roocode | openclaw (omit for interactive)')
    .action(async (agent?: string) => {
        if (agent === 'claude-code') { await useClaudeCode(); return; }
        if (agent === 'roocode')     { await useRoocode();    return; }
        if (agent === 'openclaw')    { await useOpenclaw();   return; }
        if (agent) {
            console.log(chalk.red(`Unknown agent: ${agent}`));
            process.exit(1);
        }

        const agents = await checkbox({
            message: 'Which AI agent do you want to integrate?',
            choices: [
                { name: 'Claude Code', value: 'claude-code' },
                { name: 'RooCode',     value: 'roocode'     },
                { name: 'OpenClaw',    value: 'openclaw'    },
            ],
        });
        for (const a of agents) {
            if (a === 'claude-code') await useClaudeCode();
            else if (a === 'roocode')  await useRoocode();
            else if (a === 'openclaw') await useOpenclaw();
        }
    });

program
    .command('validate')
    .description('Check repo directory structure (skills/, commands/, hooks/)')
    .argument('[local-path]', 'Path to the prompt repo (overrides config)')
    .action(async (localPath?: string) => {
        await validateCommand(localPath);
    });

program
    .command('unload')
    .description('Remove all set-prompt data (config, Claude Code plugin dir, home dir)')
    .action(async () => {
        await unloadCommand();
    });

program.parse(process.argv);
