import { spawnSync } from 'child_process';
import chalk from 'chalk';

interface FileChange {
    /** 'A' added, 'M' modified, 'D' deleted, 'R' renamed, '?' untracked */
    kind: 'A' | 'M' | 'D' | 'R' | '?';
    name: string;
}

const parsePorcelainLine = (line: string): FileChange | null => {
    // Porcelain v1 format: "XY filename" (X=staged, Y=unstaged), 2-char status + space + name
    if (line.length < 4) return null;
    const status = line.slice(0, 2);
    let name = line.slice(3);
    // Renames look like "R  old -> new" — take the new name
    const arrowIdx = name.indexOf(' -> ');
    if (arrowIdx >= 0) name = name.slice(arrowIdx + 4);
    // Strip surrounding quotes that git adds for paths with special chars
    if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);

    // Priority: untracked > delete > rename > add > modify
    if (status.includes('?')) return { kind: '?', name };
    if (status.includes('D')) return { kind: 'D', name };
    if (status.includes('R')) return { kind: 'R', name };
    if (status.includes('A')) return { kind: 'A', name };
    if (status.includes('M')) return { kind: 'M', name };
    return null;
};

const pickVerb = (files: FileChange[]): string => {
    const allAdded   = files.every(f => f.kind === 'A' || f.kind === '?');
    const allDeleted = files.every(f => f.kind === 'D');
    if (allAdded) return 'add';
    if (allDeleted) return 'remove';
    return 'update';
};

/**
 * Generates a commit message from the current working-tree changes.
 * Returns null when there is nothing to commit.
 *
 * Format (git subject + body):
 *   <verb> <N> file(s)
 *
 *   - <path1>
 *   - <path2>
 *   ...
 */
export const generateCommitMessage = (repoPath: string): string | null => {
    const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
        cwd: repoPath,
        encoding: 'utf8',
    });
    if (result.status !== 0) return null;

    const files = result.stdout
        .split('\n')
        .map(parsePorcelainLine)
        .filter((f): f is FileChange => f !== null);

    if (files.length === 0) return null;

    const verb = pickVerb(files);
    const noun = files.length === 1 ? 'file' : 'files';
    const subject = `${verb} ${files.length} ${noun}`;
    const body = files.map(f => `- ${f.name}`).join('\n');

    return `${subject}\n\n${body}`;
};

/**
 * Prints a hint guiding the user to run `sppt repo save` when the working tree is dirty.
 * Silent when clean or when the path isn't a git repo. Used by `scaffold` and `install`
 * to nudge (not auto-execute) the commit+push step after generating/cloning files.
 */
export const printSaveHint = (repoPath: string): void => {
    const generated = generateCommitMessage(repoPath);
    if (generated == null) return;

    const subject = generated.split('\n')[0];
    console.log(chalk.yellow('\nUncommitted changes detected.'));
    console.log(chalk.dim(`  Pending: ${subject}`));
    console.log(chalk.cyan('  Tip: run `sppt repo save` to commit and push.'));
};
