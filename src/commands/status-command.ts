import chalk from 'chalk';
import { TAB, ALL_AGENTS, TOOLS } from '@/_defs';
import { configManager } from '@/_libs/config';

export const statusCommand = (): void => {
    if (configManager.repo_path == null) {
        console.log(chalk.yellow('❌ No repo installed.'));
        console.log(chalk.dim(`  Run: set-prompt install <repo-url>`));
        return;
    }

    // Repo
    console.log(chalk.bold('\nRepo'));
    console.log(`${TAB}path   ${chalk.cyan(configManager.repo_path)}`);
    if (configManager.remote_url != null) {
        console.log(`${TAB}remote ${chalk.dim(configManager.remote_url)}`);
    }

    // Linked agents
    console.log(chalk.bold('\nLinked agents'));
    for (const agent of ALL_AGENTS) {
        let linked = false;
        let agentPath: string | null | undefined = null;

        if (agent.value === TOOLS.CLAUDECODE) {
            linked = configManager.isClaudeCodeEnabled();
            agentPath = configManager.claude_code?.path;
        } else if (agent.value === TOOLS.ROOCODE) {
            linked = configManager.isRooCodeEnabled();
            agentPath = configManager.roocode?.path;
        } else if (agent.value === TOOLS.OPENCLAW) {
            linked = configManager.isOpenclawEnabled();
            agentPath = configManager.openclaw?.path;
        } else if (agent.value === TOOLS.CODEX) {
            linked = configManager.isCodexEnabled();
            agentPath = configManager.codex?.path;
        } else if (agent.value === TOOLS.ANTIGRAVITY) {
            linked = configManager.isAntigravityEnabled();
            agentPath = configManager.antigravity?.path;
        }

        const label = linked ? chalk.green('linked') : chalk.dim('not linked');
        const pathStr = linked && agentPath ? chalk.dim(` → ${agentPath}`) : '';
        console.log(`${TAB}${agent.name.padEnd(12)} ${label}${pathStr}`);
    }

    console.log('');
};
