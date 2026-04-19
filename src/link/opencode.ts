import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { pathExists } from 'fs-extra';
import { OPENCODE_DIR, OPENCODE_BACKUP_DIR, AGENT_PROMPT_DIRS, TOOLS } from '@/_defs';
import { configManager } from '@/_libs/config';
import { resolveRepoPath } from '@/_libs';

export const linkOpencode = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    console.log(chalk.green(`\nSetting up OpenCode integration...`));
    console.log(chalk.dim(OPENCODE_DIR));

    const opencodeDirs = AGENT_PROMPT_DIRS[TOOLS.OPENCODE];

    const backupExistingOpencodeFiles = async (): Promise<boolean> => {
        try {
            fs.mkdirSync(OPENCODE_DIR, { recursive: true });

            const dirsToBackup: string[] = [];
            for (const dir of opencodeDirs) {
                const target = path.join(OPENCODE_DIR, dir);
                if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false && fs.readdirSync(target).length > 0) {
                    dirsToBackup.push(dir);
                }
            }

            if (dirsToBackup.length === 0) {
                return true;
            }

            console.log(chalk.yellow(`\n  ⚠ The following existing directories will be replaced by symlinks:`));
            for (const dir of dirsToBackup) {
                console.log(chalk.dim(`    - ${path.join(OPENCODE_DIR, dir)}`));
            }
            console.log(chalk.yellow(`  They will be backed up to: `) + chalk.dim(OPENCODE_BACKUP_DIR));

            const ok = await confirm({ message: 'Back up existing directories?', default: true });
            if (!ok) {
                console.log(chalk.yellow('Skipped OpenCode linking.'));
                return false;
            }

            fs.mkdirSync(OPENCODE_BACKUP_DIR, { recursive: true });
            for (const dir of opencodeDirs) {
                const src = path.join(OPENCODE_DIR, dir);
                const dest = path.join(OPENCODE_BACKUP_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.yellow('  backed up') + chalk.dim(`: ${dir}/ → ${dest}`));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to backup existing directories: ${ex.message}`));
            return false;
        }
    };

    const setOpencodeAssets = async (): Promise<boolean> => {
        try {
            const linked: { dir: string; src: string }[] = [];

            for (const dir of opencodeDirs) {
                const src = path.join(repoPath, dir);
                const dest = path.join(OPENCODE_DIR, dir);

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
                console.log(chalk.dim(`  ${branch} `) + chalk.bold(`${dir}/`) + chalk.dim(` → ${src}`) + chalk.green(' ✓'));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to create symlinks: ${ex.message}`));
            return false;
        }
    };

    const backupOk = await backupExistingOpencodeFiles();
    if (backupOk === false) { return; }

    const linkOk = await setOpencodeAssets();
    if (linkOk === false) { return; }

    configManager.opencode = { path: OPENCODE_DIR, backup_path: OPENCODE_BACKUP_DIR };
    configManager.save();
};

export const unlinkOpencode = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove OpenCode symlinks from ${OPENCODE_DIR}?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    console.log(chalk.red(`\nRemoving OpenCode integration...`));
    console.log(chalk.dim(OPENCODE_DIR));

    const backupPath = configManager.opencode?.backup_path ?? OPENCODE_BACKUP_DIR;

    for (const dir of AGENT_PROMPT_DIRS[TOOLS.OPENCODE]) {
        const target = path.join(OPENCODE_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.red('  removed symlink') + chalk.dim(`: ${target}`));
        }
    }

    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.OPENCODE]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(OPENCODE_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.green('  restored') + chalk.dim(`: ${dir}/`));
            }
            fs.rmdirSync(backupPath);
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to restore OpenCode backup: ${ex.message}`));
        }
    }

    configManager.opencode = null;
    configManager.save();
};
