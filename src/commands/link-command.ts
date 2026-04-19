import chalk from 'chalk';
import { checkbox } from '@inquirer/prompts';
import { ALL_AGENTS, TOOLS } from '@/_defs';
import { configManager } from '@/_libs/config';
import { linkClaudeCode, unlinkClaudeCode } from '@/link/claudecode';
import { linkRooCode, unlinkRooCode } from '@/link/roocode';
import { linkOpenclaw, unlinkOpenclaw } from '@/link/openclaw';
import { linkAntigravity, unlinkAntigravity } from '@/link/antigravity';
import { linkCodex, unlinkCodex } from '@/link/codex';
import { linkCursor, unlinkCursor } from '@/link/cursor';
import { linkOpencode, unlinkOpencode } from '@/link/opencode';
import { linkGeminicli, unlinkGeminicli } from '@/link/geminicli';

export { linkClaudeCode, unlinkClaudeCode } from '@/link/claudecode';
export { linkRooCode, unlinkRooCode } from '@/link/roocode';
export { linkOpenclaw, unlinkOpenclaw } from '@/link/openclaw';
export { linkAntigravity, unlinkAntigravity } from '@/link/antigravity';
export { linkCodex, unlinkCodex } from '@/link/codex';
export { linkCursor, unlinkCursor } from '@/link/cursor';
export { linkOpencode, unlinkOpencode } from '@/link/opencode';
export { linkGeminicli, unlinkGeminicli } from '@/link/geminicli';

const LINK_MAP: Record<string, () => Promise<void>> = {
    [TOOLS.CLAUDECODE]:  linkClaudeCode,
    [TOOLS.ROOCODE]:     linkRooCode,
    [TOOLS.OPENCLAW]:    linkOpenclaw,
    [TOOLS.CODEX]:       linkCodex,
    [TOOLS.ANTIGRAVITY]: linkAntigravity,
    [TOOLS.CURSOR]:      linkCursor,
    [TOOLS.OPENCODE]:    linkOpencode,
    [TOOLS.GEMINICLI]:   linkGeminicli,
};

const UNLINK_MAP: Record<string, (force: boolean) => Promise<void>> = {
    [TOOLS.CLAUDECODE]:  unlinkClaudeCode,
    [TOOLS.ROOCODE]:     unlinkRooCode,
    [TOOLS.OPENCLAW]:    unlinkOpenclaw,
    [TOOLS.CODEX]:       unlinkCodex,
    [TOOLS.ANTIGRAVITY]: unlinkAntigravity,
    [TOOLS.CURSOR]:      unlinkCursor,
    [TOOLS.OPENCODE]:    unlinkOpencode,
    [TOOLS.GEMINICLI]:   unlinkGeminicli,
};

export const linkCommand = async (tool?: string): Promise<void> => {
    if (tool != null) {
        const known = ALL_AGENTS.some(a => a.value === tool);
        if (!known) {
            console.log(chalk.red(`Unknown vendor: ${tool}`));
            process.exit(1);
        }
        await LINK_MAP[tool]();
        return;
    }

    const prevLinked: Record<string, boolean> = {
        [TOOLS.CLAUDECODE]:  configManager.isClaudeCodeEnabled(),
        [TOOLS.ROOCODE]:     configManager.isRooCodeEnabled(),
        [TOOLS.OPENCLAW]:    configManager.isOpenclawEnabled(),
        [TOOLS.CODEX]:       configManager.isCodexEnabled(),
        [TOOLS.ANTIGRAVITY]: configManager.isAntigravityEnabled(),
        [TOOLS.CURSOR]:      configManager.isCursorEnabled(),
        [TOOLS.OPENCODE]:    configManager.isOpencodeEnabled(),
        [TOOLS.GEMINICLI]:   configManager.isGeminicliEnabled(),
    };

    const selected = await checkbox({
        message: 'Which AI agent do you want to integrate?',
        choices: ALL_AGENTS.map(a => ({
            name: prevLinked[a.value] ? `${a.name} ${chalk.dim('(applied)')}` : a.name,
            value: a.value,
            checked: prevLinked[a.value],
        })),
        pageSize: ALL_AGENTS.length,
        loop: false,
    });

    const toLink   = ALL_AGENTS.filter(a => !prevLinked[a.value] &&  selected.includes(a.value));
    const toUnlink = ALL_AGENTS.filter(a =>  prevLinked[a.value] && !selected.includes(a.value));

    console.log();
    if (toLink.length > 0)   { console.log(chalk.green('  Link   ') + chalk.dim('→ ') + toLink.map(a => chalk.bold(a.name)).join(chalk.dim(', '))); }
    if (toUnlink.length > 0) { console.log(chalk.red('  Unlink ') + chalk.dim('→ ') + toUnlink.map(a => chalk.bold(a.name)).join(chalk.dim(', '))); }
    console.log();

    if (toLink.length === 0 && toUnlink.length === 0) { return; }

    for (const a of ALL_AGENTS) {
        const was = prevLinked[a.value];
        const now = selected.includes(a.value);

        if (!was && now) {
            await LINK_MAP[a.value]();
        }
        if (was && !now) {
            await UNLINK_MAP[a.value](true);
        }
    }
};
