import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { pathExists } from 'fs-extra';
import { OPENCLAW_DIR, OPENCLAW_BACKUP_DIR, AGENT_PROMPT_DIRS, TOOLS } from '@/_defs';
import { configManager } from '@/_libs/config';
import { resolveRepoPath } from '@/_libs';

export const linkOpenclaw = async (): Promise<void> => {
    const repoPath = resolveRepoPath();
    if (repoPath == null) { return; }

    console.log(chalk.green(`\nSetting up OpenClaw integration...`));
    console.log(chalk.dim(OPENCLAW_DIR));

    const openclawDirs = AGENT_PROMPT_DIRS[TOOLS.OPENCLAW];

    const backupExistingOpenclawFiles = async (): Promise<boolean> => {
        try {
            fs.mkdirSync(OPENCLAW_DIR, { recursive: true });

            const dirsToBackup: string[] = [];
            for (const dir of openclawDirs) {
                const target = path.join(OPENCLAW_DIR, dir);
                if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink() === false && fs.readdirSync(target).length > 0) {
                    dirsToBackup.push(dir);
                }
            }

            if (dirsToBackup.length === 0) {
                return true;
            }

            console.log(chalk.yellow(`\n  ⚠ The following existing directories will be replaced by symlinks:`));
            for (const dir of dirsToBackup) {
                console.log(chalk.dim(`    - ${path.join(OPENCLAW_DIR, dir)}`));
            }
            console.log(chalk.yellow(`  They will be backed up to: `) + chalk.dim(OPENCLAW_BACKUP_DIR));

            const ok = await confirm({ message: 'Back up existing directories?', default: true });
            if (!ok) {
                console.log(chalk.yellow('Skipped OpenClaw linking.'));
                return false;
            }

            fs.mkdirSync(OPENCLAW_BACKUP_DIR, { recursive: true });
            for (const dir of dirsToBackup) {
                const src = path.join(OPENCLAW_DIR, dir);
                const dest = path.join(OPENCLAW_BACKUP_DIR, dir);
                fs.renameSync(src, dest);
                console.log(chalk.yellow('  backed up') + chalk.dim(`: ${dir}/ → ${dest}`));
            }

            return true;
        } catch (ex: any) {
            console.error(chalk.red(`❌ Failed to backup existing directories: ${ex.message}`));
            return false;
        }
    };

    const setOpenclawAssets = async (): Promise<boolean> => {
        try {
            const linked: { dir: string; src: string }[] = [];

            for (const dir of openclawDirs) {
                const src = path.join(repoPath, dir);
                const dest = path.join(OPENCLAW_DIR, dir);

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

    const backupOk = await backupExistingOpenclawFiles();
    if (backupOk === false) { return; }

    const linkOk = await setOpenclawAssets();
    if (linkOk === false) { return; }

    configManager.openclaw = { path: OPENCLAW_DIR, backup_path: OPENCLAW_BACKUP_DIR };
    configManager.save();
};

export const unlinkOpenclaw = async (force = false): Promise<void> => {
    if (!force) {
        const ok = await confirm({
            message: `Remove OpenClaw symlinks from ${OPENCLAW_DIR}?`,
            default: false,
        });
        if (!ok) { console.log(chalk.yellow('Cancelled.')); return; }
    }

    console.log(chalk.red(`\nRemoving OpenClaw integration...`));
    console.log(chalk.dim(OPENCLAW_DIR));

    const backupPath = configManager.openclaw?.backup_path ?? OPENCLAW_BACKUP_DIR;

    for (const dir of AGENT_PROMPT_DIRS[TOOLS.OPENCLAW]) {
        const target = path.join(OPENCLAW_DIR, dir);
        if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
            fs.unlinkSync(target);
            console.log(chalk.red('  removed symlink') + chalk.dim(`: ${target}`));
        }
    }

    if (fs.existsSync(backupPath)) {
        try {
            for (const dir of AGENT_PROMPT_DIRS[TOOLS.OPENCLAW]) {
                const src = path.join(backupPath, dir);
                const dest = path.join(OPENCLAW_DIR, dir);
                if (!fs.existsSync(src)) { continue; }
                fs.renameSync(src, dest);
                console.log(chalk.green('  restored') + chalk.dim(`: ${dir}/`));
            }
            fs.rmdirSync(backupPath);
        } catch (ex: any) {
            console.error(chalk.red(`  ❌ Failed to restore OpenClaw backup: ${ex.message}`));
        }
    }

    configManager.openclaw = null;
    configManager.save();
};
