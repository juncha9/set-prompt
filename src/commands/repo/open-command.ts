import { spawn } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import { configManager } from '@/_libs/config';
import { isOnPath, firstExistingPath } from '@/_libs';

export interface RepoOpenOptions {
    /** Open with VSCode (`code <path>`) instead of the OS file manager. */
    code?: boolean;
    /** Open with Sourcetree instead of the OS file manager. */
    stree?: boolean;
}

/** Resolved launch target: binary + args to pass. */
interface LaunchTarget {
    bin: string;
    args: string[];
}

/**
 * Resolves how to launch VSCode with a repo path.
 * Relies on the `code` CLI being on PATH.
 */
const resolveVscodeTarget = (repoPath: string): LaunchTarget | null => {
    if (isOnPath('code') === false) return null;
    return { bin: 'code', args: [repoPath] };
};

/**
 * Resolves how to launch Sourcetree with a repo path.
 *
 * - macOS: `stree <path>` (requires user to install CLI tools via Sourcetree menu)
 * - Windows: auto-detect `SourceTree.exe` in common install locations and use `-f <path>`
 *   (Windows Sourcetree doesn't ship with a `stree` wrapper)
 * - Linux: unsupported (Sourcetree is macOS/Windows only)
 */
const resolveSourcetreeTarget = (repoPath: string): LaunchTarget | null => {
    if (isOnPath('stree')) {
        return { bin: 'stree', args: [repoPath] };
    }
    if (process.platform === 'win32') {
        const exe = firstExistingPath([
            process.env.LOCALAPPDATA          && path.join(process.env.LOCALAPPDATA,          'SourceTree', 'SourceTree.exe'),
            process.env['ProgramFiles(x86)']  && path.join(process.env['ProgramFiles(x86)'],  'Atlassian', 'SourceTree', 'SourceTree.exe'),
            process.env.ProgramFiles          && path.join(process.env.ProgramFiles,          'Atlassian', 'SourceTree', 'SourceTree.exe'),
        ]);
        if (exe != null) return { bin: exe, args: ['-f', repoPath] };
    }
    return null;
};

const VSCODE_INSTALL_HINT = 'Install VSCode CLI: View → Command Palette → "Shell Command: Install \'code\' command"';

const sourcetreeInstallHint = (): string => {
    if (process.platform === 'darwin') {
        return 'Install Sourcetree, then: Sourcetree menu bar → "Install Command Line Tools"';
    }
    if (process.platform === 'win32') {
        return 'Install Sourcetree from https://sourcetreeapp.com/ — this CLI auto-detects it at %LOCALAPPDATA%\\SourceTree';
    }
    return 'Sourcetree is not available on Linux — try a native Git GUI instead';
};

const runLaunch = (label: string, target: LaunchTarget): void => {
    console.log(chalk.green(`Opening in ${label}: ${chalk.dim(target.args[target.args.length - 1])}`));
    const child = spawn(target.bin, target.args, { stdio: 'ignore', detached: true, shell: true });
    child.unref();
};

/**
 * Opens the installed repo in the OS file manager by default, or in a specific app
 * when a flag (`--code`, `--stree`) is set. Detached + unref so the CLI exits
 * immediately after launching.
 *
 * Flag precedence (highest first): `--code` > `--stree` > default file manager.
 */
export const repoOpenCommand = (options: RepoOpenOptions = {}): void => {
    const repoPath = configManager.repo_path;
    if (repoPath == null) {
        console.error(chalk.red('❌ No repo installed.'));
        console.log(chalk.yellow('Run: set-prompt install <git-url>'));
        return;
    }

    if (options.code === true) {
        const target = resolveVscodeTarget(repoPath);
        if (target == null) {
            console.error(chalk.red('❌ VSCode CLI (`code`) not found on PATH.'));
            console.log(chalk.dim(`   ${VSCODE_INSTALL_HINT}`));
            return;
        }
        runLaunch('VSCode', target);
        return;
    }

    if (options.stree === true) {
        const target = resolveSourcetreeTarget(repoPath);
        if (target == null) {
            console.error(chalk.red('❌ Sourcetree not found.'));
            console.log(chalk.dim(`   ${sourcetreeInstallHint()}`));
            return;
        }
        runLaunch('Sourcetree', target);
        return;
    }

    const platform = process.platform;
    const opener = platform === 'win32' ? 'explorer'
                 : platform === 'darwin' ? 'open'
                 : 'xdg-open';

    console.log(chalk.green(`Opening: ${chalk.dim(repoPath)}`));
    const child = spawn(opener, [repoPath], { stdio: 'ignore', detached: true });
    child.on('error', (ex) => {
        console.error(chalk.red(`❌ Failed to open: ${ex.message}`));
    });
    child.unref();
};
