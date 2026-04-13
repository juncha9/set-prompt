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
import { repoPullCommand } from '@/commands/repo/pull-command';
import { repoCommitCommand } from '@/commands/repo/commit-command';
import { repoPushCommand } from '@/commands/repo/push-command';
import { repoSaveCommand } from '@/commands/repo/save-command';
import { repoStatusCommand } from '@/commands/repo/status-command';
import { repoPathCommand } from '@/commands/repo/path-command';
import { repoOpenCommand } from '@/commands/repo/open-command';
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
    .addHelpText('beforeAll', ({ command }) => (command === program ? banner + '\n' : ''));

program
    .command('install')
    .description(`📦 Clone a ${chalk.cyan('git repo')} into ${chalk.dim('~/.set-prompt/repo/')} and register it as your prompt source`)
    .argument('<url>', 'remote git URL')
    .action(async (source: string) => {
        await installCommand(source);
    });

program
    .command('link')
    .description(`🔗 Symlink your prompt repo into an ${chalk.cyan('AI agent')} plugin dir ${chalk.dim('(claudecode | roocode | openclaw | codex | antigravity)')}`)
    .argument('[agent]', `target agent ${chalk.dim('(omit for interactive selection)')}`)
    .action(async (agent?: string) => {
        await linkCommand(agent);
    });

program
    .command('scaffold')
    .description(`🛠️  Verify and create ${chalk.cyan('required directories')} in a prompt repo ${chalk.dim('(-f to force overwrite)')}`)
    .argument('[path]', `path to repo ${chalk.dim('(defaults to installed source)')}`)
    .action(async (localPath?: string) => {
        await scaffoldCommand(localPath);
    });

program
    .command('status')
    .description(`📋 Show registered ${chalk.cyan('repo')} and which ${chalk.cyan('agents')} are linked`)
    .action(() => {
        statusCommand();
    });

const repo = program
    .command('repo')
    .description(`🗂️  Manage the installed prompt repo ${chalk.dim('(status | pull | commit | push | save | path | open)')}`);

repo
    .command('status')
    .description(`📋 Show VCS status of the repo ${chalk.dim('(branch, ahead/behind, changed files)')}`)
    .addHelpText('after', `
Example output:
  📂 ~/.set-prompt/repo
  🌿 main → origin/main (ahead 2)

  📝 Changes (2):
     modified   skills/foo.md
     untracked  draft.md
`)
    .action(() => {
        repoStatusCommand();
    });

repo
    .command('pull')
    .description(`🔄 Fetch and pull the latest changes from the ${chalk.cyan('remote repo')}`)
    .action(() => {
        repoPullCommand();
    });

repo
    .command('commit')
    .description(`📝 Stage all changes and commit ${chalk.dim('(auto-generates message if -m omitted; does not push)')}`)
    .option('-m, --message <msg>', 'commit message (auto-generated from changed files if omitted)')
    .addHelpText('after', `
Examples:
  $ sppt repo commit -m "edit dbml skill"
  $ sppt repo commit                          ${chalk.dim('# auto-generates "update N files" + file list')}
`)
    .action((opts: { message?: string }) => {
        repoCommitCommand({ message: opts.message });
    });

repo
    .command('push')
    .description(`⬆️  Push local commits to the remote`)
    .action(() => {
        repoPushCommand();
    });

repo
    .command('save')
    .description(`💾 Stage + commit + push in one step ${chalk.dim('(macro for commit → push; auto-generates message if -m omitted)')}`)
    .option('-m, --message <msg>', 'commit message (auto-generated from changed files if omitted)')
    .addHelpText('after', `
Examples:
  $ sppt repo save -m "edit dbml skill"
  $ sppt repo save                            ${chalk.dim('# auto-generates message and pushes')}

Equivalent to: sppt repo commit && sppt repo push
`)
    .action((opts: { message?: string }) => {
        repoSaveCommand({ message: opts.message });
    });

repo
    .command('path')
    .description(`📍 Print the repo path to stdout ${chalk.dim('(e.g. cd $(sppt repo path))')}`)
    .addHelpText('after', `
Examples:
  $ sppt repo path
  ${chalk.dim('/Users/me/.set-prompt/repo')}

  $ cd "$(sppt repo path)"                    ${chalk.dim('# jump into the repo')}
  $ code "$(sppt repo path)"                  ${chalk.dim('# open in VSCode')}
`)
    .action(() => {
        repoPathCommand();
    });

repo
    .command('open')
    .description(`📂 Open the repo in the OS file manager ${chalk.dim('(--code: VSCode, --stree: Sourcetree)')}`)
    .option('--code', 'open with VSCode (`code` CLI)')
    .option('--stree', 'open with Sourcetree (`stree` CLI)')
    .addHelpText('after', `
Examples:
  $ sppt repo open                            ${chalk.dim('# Explorer / Finder / xdg-open')}
  $ sppt repo open --code                     ${chalk.dim('# open in VSCode')}
  $ sppt repo open --stree                    ${chalk.dim('# open in Sourcetree')}
`)
    .action((opts: { code?: boolean; stree?: boolean }) => {
        repoOpenCommand({ code: opts.code, stree: opts.stree });
    });

program
    .command('uninstall')
    .description(`🗑️  Remove all set-prompt data ${chalk.dim('(~/.set-prompt/, plugin dirs, settings entries)')}`)
    .action(async () => {
        await uninstallCommand();
    });

program.parse(process.argv);
