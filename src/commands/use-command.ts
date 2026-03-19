import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { confirm, checkbox } from '@inquirer/prompts';
import { pathExists } from 'fs-extra';
import { CLAUDE_CODE_DIR, REPO_DIRS, ALL_AGENTS, TOOLS } from '@/_defs';
import type { AgentId } from '@/_defs';
import { configManager } from '@/_libs/config';

const spinner = ora();

const resolveRepoPath = (): string | null => {
    if (configManager.repo_path == null) {
        console.error(chalk.red('No prompt source registered.'));
        console.log(chalk.yellow('Run: set-prompt use <local-path or git-url>'));
        return null;
    }
    return configManager.repo_path;
};

const isApplied = (agent: TOOLS): boolean => {
    if (agent === TOOLS.CLAUDE_CODE) { return configManager.claude_code?.enabled === true; }
    if (agent === TOOLS.ROOCODE)     { return configManager.roocode?.enabled === true; }
    if (agent === TOOLS.OPENCLAW)    { return configManager.openclaw?.enabled === true; }
    return false;
};

const markApplied = (agent: AgentId): void => {
    if (configManager.repo_path == null) { return; }

    const base = {
        repo_path:  configManager.repo_path,
        remote_url: configManager.remote_url,
        claude_code: configManager.claude_code,
        roocode:    configManager.roocode,
        openclaw:   configManager.openclaw,
    };

    if (agent === TOOLS.CLAUDE_CODE) {
        configManager.save({ ...base, claude_code: { enabled: true } });
    } else if (agent === TOOLS.ROOCODE) {
        configManager.save({ ...base, roocode: { enabled: true, path: configManager.roocode?.path ?? null } });
    } else if (agent === TOOLS.OPENCLAW) {
        configManager.save({ ...base, openclaw: { enabled: true, path: configManager.openclaw?.path ?? null } });
    }
};

const PLUGIN_NAME = 'set-prompt';

const applyAgent = async (agent: AgentId): Promise<void> => {
    if (agent === TOOLS.CLAUDE_CODE) { await useClaudeCode(); }
    else if (agent === TOOLS.ROOCODE)  { await useRoocode(); }
    else if (agent === TOOLS.OPENCLAW) { await useOpenclaw(); }
    markApplied(agent);
};

export const useClaudeCode = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    const dirs = REPO_DIRS;

    console.log(chalk.green(`\nSetting up Claude Code plugin...`));
    console.log(chalk.dim(CLAUDE_CODE_DIR));

    // marketplace root: ~/.set-prompt/claude-code/
    fs.mkdirSync(CLAUDE_CODE_DIR, { recursive: true });

    // marketplace.json
    const marketplaceMetaDir = path.join(CLAUDE_CODE_DIR, '.claude-plugin');
    fs.mkdirSync(marketplaceMetaDir, { recursive: true });
    const marketplaceJson = {
        name: PLUGIN_NAME,
        plugins: [{ name: PLUGIN_NAME, source: `./plugins/${PLUGIN_NAME}` }],
    };
    fs.writeFileSync(
        path.join(marketplaceMetaDir, 'marketplace.json'),
        JSON.stringify(marketplaceJson, null, 2),
        'utf-8',
    );
    console.log(chalk.dim('  ├── .claude-plugin/'));
    console.log(chalk.dim('  │   └── marketplace.json') + chalk.green(' ✓'));

    // plugin dir: ~/.set-prompt/claude-code/plugins/set-prompt/
    const pluginDir = path.join(CLAUDE_CODE_DIR, 'plugins', PLUGIN_NAME);
    fs.mkdirSync(pluginDir, { recursive: true });
    console.log(chalk.dim('  └── plugins/'));
    console.log(chalk.dim(`      └── ${PLUGIN_NAME}/`));

    // plugin.json
    const pluginMetaDir = path.join(pluginDir, '.claude-plugin');
    fs.mkdirSync(pluginMetaDir, { recursive: true });
    const pluginJson = {
        name: PLUGIN_NAME,
        version: '1.0.0',
        description: 'Prompts managed by set-prompt',
        author: { name: path.basename(repoPath) },
    };
    fs.writeFileSync(
        path.join(pluginMetaDir, 'plugin.json'),
        JSON.stringify(pluginJson, null, 2),
        'utf-8',
    );
    console.log(chalk.dim('          ├── .claude-plugin/'));
    console.log(chalk.dim('          │   └── plugin.json') + chalk.green(' ✓'));

    const linked: { dir: string; src: string }[] = [];

    for (const dir of dirs) {
        const src = path.join(repoPath, dir);
        const dest = path.join(pluginDir, dir);

        if ((await pathExists(src)) === false) { continue; }

        if (fs.existsSync(dest)) {
            fs.rmSync(dest, { recursive: true, force: true });
        }

        const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
        fs.symlinkSync(src, dest, symlinkType);
        linked.push({ dir, src });
    }

    for (const { dir, src } of linked) {
        const isLast = linked[linked.length - 1].dir === dir;
        const branch = isLast ? '└──' : '├──';
        console.log(chalk.dim(`          ${branch} `) + chalk.bold(`${dir}/`) + chalk.dim(` → ${src}`) + chalk.green(' ✓'));
    };

    const doInstall = await confirm({
        message: 'Run "claude plugin install" now?',
        default: true,
    });

    if (doInstall) {
        spinner.start('Installing plugin...');
        const result = spawnSync('claude', ['plugin', 'install', CLAUDE_CODE_DIR], { stdio: 'pipe' });
        if (result.status !== 0) {
            spinner.fail('Plugin install failed.');
            console.error(chalk.red(result.stderr?.toString() ?? 'Unknown error'));
        } else {
            spinner.succeed('Plugin installed.');
        }
    } else {
        console.log(chalk.dim(`\nRun manually: claude plugin install ${CLAUDE_CODE_DIR}`));
    }
};

export const useRoocode = async (): Promise<void> => {
    if (resolveRepoPath() == null) { return; }
    console.log(chalk.yellow('RooCode integration is not yet implemented.'));
};

export const useOpenclaw = async (): Promise<void> => {
    if (resolveRepoPath() == null) { return; }
    console.log(chalk.yellow('OpenClaw integration is not yet implemented.'));
};

export const useCommand = async (tool?: string): Promise<void> => {
    if (tool != null) {
        const known = ALL_AGENTS.some(a => a.value === tool);
        if (known === false) {
            console.log(chalk.red(`Unknown vendor: ${tool}`));
            process.exit(1);
        }
        await applyAgent(tool as AgentId);
        return;
    }

    const selected = await checkbox({
        message: 'Which AI agent do you want to integrate?',
        choices: ALL_AGENTS.map(a => ({
            name: isApplied(a.value) ? `${a.name} ${chalk.dim('(applied)')}` : a.name,
            value: a.value,
            checked: isApplied(a.value),
        })),
    });

    for (const a of selected) {
        await applyAgent(a);
    }
};
