import { spawnSync } from 'child_process';
import chalk from 'chalk';
import { configManager } from '@/_libs/config';

interface BranchInfo {
    branch: string | null;
    upstream: string | null;
    ahead: number;
    behind: number;
}

interface FileChange {
    label: string;
    color: (s: string) => string;
    path: string;
}

const parseBranchLine = (line: string): BranchInfo => {
    // Formats:
    //   "## main...origin/main"
    //   "## main...origin/main [ahead 2]"
    //   "## main...origin/main [ahead 2, behind 1]"
    //   "## main"                            (no upstream)
    //   "## HEAD (no branch)"                (detached)
    const body = line.replace(/^## /, '');
    if (body.startsWith('HEAD ') || body.includes('(no branch)')) {
        return { branch: null, upstream: null, ahead: 0, behind: 0 };
    }

    const [refPart, bracketPart] = body.split(/\s+(?=\[)/);
    const [branch, upstream] = refPart.split('...');

    let ahead = 0;
    let behind = 0;
    if (bracketPart != null) {
        const inside = bracketPart.replace(/[\[\]]/g, '');
        for (const piece of inside.split(',').map(s => s.trim())) {
            const m = piece.match(/^(ahead|behind) (\d+)$/);
            if (m == null) continue;
            if (m[1] === 'ahead')  ahead  = Number(m[2]);
            if (m[1] === 'behind') behind = Number(m[2]);
        }
    }

    return { branch: branch ?? null, upstream: upstream ?? null, ahead, behind };
};

const parseFileLine = (line: string): FileChange | null => {
    if (line.length < 4) return null;
    const status = line.slice(0, 2);
    let name = line.slice(3);
    const arrowIdx = name.indexOf(' -> ');
    if (arrowIdx >= 0) name = name.slice(arrowIdx + 4);
    if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);

    if (status.includes('?')) return { label: 'untracked', color: chalk.gray,   path: name };
    if (status.includes('D')) return { label: 'deleted',   color: chalk.red,    path: name };
    if (status.includes('R')) return { label: 'renamed',   color: chalk.cyan,   path: name };
    if (status.includes('A')) return { label: 'added',     color: chalk.green,  path: name };
    if (status.includes('M')) return { label: 'modified',  color: chalk.yellow, path: name };
    return null;
};

const formatUpstream = (info: BranchInfo): string => {
    if (info.branch == null) return chalk.red('(detached HEAD)');
    if (info.upstream == null) return `${info.branch} ${chalk.yellow('(no upstream)')}`;

    const segs: string[] = [];
    if (info.ahead > 0)  segs.push(chalk.green(`ahead ${info.ahead}`));
    if (info.behind > 0) segs.push(chalk.red(`behind ${info.behind}`));
    const trailing = segs.length > 0 ? ` (${segs.join(', ')})` : chalk.dim(' (up to date)');
    return `${info.branch} ${chalk.dim('→')} ${info.upstream}${trailing}`;
};

export const repoStatusCommand = (): void => {
    const repoPath = configManager.repo_path;
    if (repoPath == null) {
        console.error(chalk.red('❌ No repo installed.'));
        console.log(chalk.yellow('Run: set-prompt install <git-url>'));
        return;
    }

    const result = spawnSync('git', ['status', '--porcelain=v1', '--branch', '--untracked-files=all'], {
        cwd: repoPath,
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        console.error(chalk.red('❌ git status failed.'));
        if (result.stderr) console.error(chalk.dim(result.stderr));
        return;
    }

    const lines = result.stdout.split('\n').filter(l => l.length > 0);
    const branchLine = lines[0] ?? '## (unknown)';
    const fileLines = lines.slice(1);

    const branchInfo = parseBranchLine(branchLine);
    const changes = fileLines
        .map(parseFileLine)
        .filter((f): f is FileChange => f !== null);

    console.log(`${chalk.cyan('📂')} ${chalk.dim(repoPath)}`);
    console.log(`${chalk.cyan('🌿')} ${formatUpstream(branchInfo)}`);
    console.log('');

    if (changes.length === 0) {
        console.log(chalk.green('✅ Working tree clean'));
        return;
    }

    console.log(chalk.bold(`📝 Changes (${changes.length}):`));
    const labelWidth = Math.max(...changes.map(c => c.label.length));
    for (const c of changes) {
        const label = c.color(c.label.padEnd(labelWidth));
        console.log(`   ${label}  ${c.path}`);
    }
};
