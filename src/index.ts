import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

console.log(
  chalk.cyan(
    figlet.textSync('Set-Prompt', { horizontalLayout: 'full' })
  )
);

program
  .name('set-prompt')
  .description(pkg.description)
  .version(pkg.version);

program.command('install')
  .description('Install a prompt/skill from a local file or git repo')
  .argument('<source>', 'Path to YAML/JSON file or Git URL')
  .option('-t, --target <platforms...>', 'Target platforms (openclaw, claude, roo)', ['openclaw'])
  .action(async (source, options) => {
    console.log(chalk.green(`🚀 Installing prompt from: ${source}`));
    console.log(chalk.yellow(`🎯 Targets: ${options.target.join(', ')}`));
  });

program.command('validate')
  .description('Validate a prompt definition file against schema')
  .argument('<file>', 'Path to YAML/JSON file')
  .action(async (file) => {
    console.log(chalk.blue(`🔍 Validating: ${file}`));
  });

program.parse(process.argv);
