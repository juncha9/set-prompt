import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { PROMPT_DIR_NAMES, PLUGIN_NAME, TAB } from '@/_defs';
import { SET_PROMPT_GUIDE } from '@/_libs/templates';
import { configManager } from '@/_libs/config';

// ─── 플러그인 매니페스트 생성 함수 ──────────────────────────────────────────

export const ensureClaudePluginManifest = (repoPath: string): void => {
    const metaDir = path.join(repoPath, '.claude-plugin');
    const jsonPath = path.join(metaDir, 'plugin.json');
    fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify({
        name: PLUGIN_NAME,
        version: '1.0.0',
        description: `Managed by set-prompt — ${repoPath}`,
    }, null, 4), { encoding: 'utf-8' });
};

export const ensureCodexPluginManifest = (repoPath: string): void => {
    const metaDir = path.join(repoPath, '.codex-plugin');
    const jsonPath = path.join(metaDir, 'plugin.json');
    fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify({
        name: PLUGIN_NAME,
        version: '1.0.0',
        description: `Managed by set-prompt — ${repoPath}`,
        skills: './skills/',
        mcpServers: './.mcp.json',
        apps: './.app.json',
    }, null, 4), { encoding: 'utf-8' });
};

// ─── 설정 파일 생성 함수 ─────────────────────────────────────────────────────

export const ensureMcpJson = (repoPath: string): boolean => {
    const mcpJsonPath = path.join(repoPath, '.mcp.json');
    if (fs.existsSync(mcpJsonPath)) { return false; }
    fs.writeFileSync(mcpJsonPath, JSON.stringify({ mcpServers: {} }, null, 4), { encoding: 'utf-8' });
    return true;
};

export const ensureAppJson = (repoPath: string): boolean => {
    const appJsonPath = path.join(repoPath, '.app.json');
    if (fs.existsSync(appJsonPath)) { return false; }
    fs.writeFileSync(appJsonPath, JSON.stringify({ apps: {} }, null, 4), { encoding: 'utf-8' });
    return true;
};

// ─── scaffold ───────────────────────────────────────────────────────────────

export const scaffoldCommand = async (localPath?: string): Promise<boolean> => {
    try {
        // ── 1. 대상 경로 결정 ────────────────────────────────────────────
        let targetPath: string | null = null;

        if (localPath != null) {
            targetPath = localPath;
        } else {
            if (configManager.repo_path != null) {
                targetPath = configManager.repo_path;
            } else {
                console.error(chalk.red('No path provided and no repo registered. Please provide a path.'));
                process.exit(1);
            }
        }

        if (fs.existsSync(targetPath) === false || fs.statSync(targetPath).isDirectory() === false) {
            console.error(chalk.red(`Invalid directory path: '${targetPath}'`));
            process.exit(1);
        }

        console.log(chalk.dim(`Scaffolding: ${targetPath}\n`));

        // ── 2. 가이드 문서 ───────────────────────────────────────────────
        const writeGuide = await confirm({
            message: 'Generate SET_PROMPT_GUIDE.md? (reference doc for writing prompts)',
            default: true,
        });
        if (writeGuide) {
            const guideMdPath = path.join(targetPath, 'SET_PROMPT_GUIDE.md');
            fs.writeFileSync(guideMdPath, SET_PROMPT_GUIDE, { encoding: 'utf-8', flag: 'w' });
            console.log(`${TAB}${chalk.green('✓')} SET_PROMPT_GUIDE.md`);
        }

        // ── 3. 프롬프트 디렉토리 ────────────────────────────────────────
        for (const dirName of PROMPT_DIR_NAMES) {
            const dirPath = path.join(targetPath, dirName);
            if (fs.existsSync(dirPath)) {
                console.log(`${TAB}${chalk.dim('✓')} ${dirName}/`);
            } else {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`${TAB}${chalk.green('+')} ${dirName}/`);
            }
            const gitkeepPath = path.join(dirPath, '.gitkeep');
            if (!fs.existsSync(gitkeepPath)) {
                fs.writeFileSync(gitkeepPath, '', { encoding: 'utf-8' });
            }
        }

        // ── 4. 플러그인 매니페스트 ──────────────────────────────────────
        ensureClaudePluginManifest(targetPath);
        console.log(`${TAB}${chalk.green('✓')} .claude-plugin/plugin.json`);

        ensureCodexPluginManifest(targetPath);
        console.log(`${TAB}${chalk.green('✓')} .codex-plugin/plugin.json`);

        // ── 5. 설정 파일 (.mcp.json, .app.json) ───────────────────────
        console.log(`${TAB}${ensureMcpJson(targetPath) ? chalk.green('+') : chalk.dim('✓')} .mcp.json`);
        console.log(`${TAB}${ensureAppJson(targetPath) ? chalk.green('+') : chalk.dim('✓')} .app.json`);

        console.log(chalk.green('\nScaffold complete.'));
        return true;
    } catch (ex: any) {
        console.error(chalk.red(`Failed to scaffold repo structure: ${ex.message}`), ex);
        throw ex;
    }
};
