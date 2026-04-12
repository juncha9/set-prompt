import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { pathExists } from 'fs-extra';
import { CURSOR_DIR, AGENT_PROMPT_DIRS, TOOLS } from '@/_defs';
import { configManager } from '@/_libs/config';
import { resolveRepoPath } from '@/_libs';

const CURSOR_BACKUP_DIR = path.join(CURSOR_DIR, 'SET_PROMPT_BACKUP');

export const linkCursor = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    console.log(chalk.green(`\nSetting up Cursor integration...`));
    console.log(chalk.dim(CURSOR_DIR));

    const cursorDirs = AGENT_PROMPT_DIRS[TOOLS.CURSOR];

    // ── 1. 기존 디렉토리 백업 ───────────────────────────────────────────
    const dirsToBackup: string[] = [];
    for (const dir of cursorDirs) {
        const target = path.join(CURSOR_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false && fs.readdirSync(target).length > 0) {
            dirsToBackup.push(dir);
        }
    }

    if (dirsToBackup.length > 0) {
        console.log(chalk.yellow(`\n  ⚠ The following existing directories will be replaced by symlinks:`));
        for (const dir of dirsToBackup) {
            console.log(chalk.dim(`    - ${path.join(CURSOR_DIR, dir)}`));
        }
        console.log(chalk.yellow(`  They will be backed up to: `) + chalk.dim(CURSOR_BACKUP_DIR));

        const ok = await confirm({ message: 'Back up existing directories?', default: true });
        if (!ok) {
            console.log(chalk.yellow('Skipped Cursor linking.'));
            return;
        }

        fs.mkdirSync(CURSOR_BACKUP_DIR, { recursive: true });
        for (const dir of dirsToBackup) {
            const src = path.join(CURSOR_DIR, dir);
            const dest = path.join(CURSOR_BACKUP_DIR, dir);
            fs.renameSync(src, dest);
            console.log(chalk.yellow('  backed up') + chalk.dim(`: ${dir}/ → ${dest}`));
        }
    }

    // ── 2. 심볼릭 링크 생성 ─────────────────────────────────────────────
    try {
        const linked: { dir: string; src: string }[] = [];
        for (const dir of cursorDirs) {
            const src = path.join(repoPath, dir);
            const dest = path.join(CURSOR_DIR, dir);

            if ((await pathExists(src)) === false) { continue; }

            if (fs.existsSync(dest)) {
                fs.rmSync(dest, { recursive: true, force: true });
            }

            const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
            fs.symlinkSync(src, dest, symlinkType);
            linked.push({ dir, src });
        }

        for (const { dir, src } of linked) {
            console.log(chalk.dim(`  ├── `) + chalk.bold(`${dir}/`) + chalk.dim(` → ${src}`) + chalk.green(' ✓'));
        }

        // ── 3. .mcp.json 하드링크 ───────────────────────────────────────
        const mcpSrc = path.join(repoPath, '.mcp.json');
        const mcpDest = path.join(CURSOR_DIR, 'mcp.json');
        if (fs.existsSync(mcpSrc)) {
            if (fs.existsSync(mcpDest) && fs.statSync(mcpDest).ino !== fs.statSync(mcpSrc).ino) {
                const mcpBackup = path.join(CURSOR_BACKUP_DIR, 'mcp.json');
                fs.mkdirSync(CURSOR_BACKUP_DIR, { recursive: true });
                fs.renameSync(mcpDest, mcpBackup);
                console.log(chalk.yellow('  backed up') + chalk.dim(`: mcp.json → ${mcpBackup}`));
            }
            if (fs.existsSync(mcpDest)) { fs.unlinkSync(mcpDest); }
            fs.linkSync(mcpSrc, mcpDest);
            console.log(chalk.dim(`  └── `) + chalk.bold('mcp.json') + chalk.dim(` ⇔ ${mcpSrc}`) + chalk.green(' ✓'));
        }
    } catch (ex: any) {
        console.error(chalk.red(`❌ Failed to set up Cursor: ${ex.message}`));
        return;
    }

    configManager.cursor = { path: CURSOR_DIR, backup_path: CURSOR_BACKUP_DIR };
    configManager.save();
};

export const unlinkCursor = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove Cursor symlinks from ${CURSOR_DIR}?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    console.log(chalk.red(`\nRemoving Cursor integration...`));
    console.log(chalk.dim(CURSOR_DIR));

    const backupPath = configManager.cursor?.backup_path ?? CURSOR_BACKUP_DIR;

    // symlink 제거
    for (const dir of AGENT_PROMPT_DIRS[TOOLS.CURSOR]) {
        const target = path.join(CURSOR_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.red('  removed symlink') + chalk.dim(`: ${target}`));
        }
    }

    // mcp.json 하드링크 제거
    const mcpDest = path.join(CURSOR_DIR, 'mcp.json');
    if (fs.existsSync(mcpDest)) {
        fs.unlinkSync(mcpDest);
        console.log(chalk.red('  removed') + chalk.dim(`: ${mcpDest}`));
    }

    // 백업 복원
    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.CURSOR]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(CURSOR_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.green('  restored') + chalk.dim(`: ${dir}/`));
            }
            const mcpBackup = path.join(backupPath, 'mcp.json');
            if (fs.existsSync(mcpBackup)) {
                fs.renameSync(mcpBackup, mcpDest);
                console.log(chalk.green('  restored') + chalk.dim(`: mcp.json`));
            }
            fs.rmSync(backupPath, { recursive: true, force: true });
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to restore Cursor backup: ${ex.message}`));
        }
    }

    configManager.cursor = null;
    configManager.save();
};
