import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { PROMPT_DIR_NAMES, PLUGIN_NAME, TAB } from '@/_defs';
import { SET_PROMPT_GUIDE } from '@/_libs/templates';
import { configManager } from '@/_libs/config';
import { printSaveHint } from '@/_libs/repo';

// ─── 플러그인 매니페스트 함수 ──────────────────────────────────────────

export type EnsureResult = 'created' | 'valid' | 'invalid';

/** Validates the Claude Code plugin manifest. Returns a list of human-readable issues, or empty when OK. */
const validateClaudePluginManifest = (data: unknown): string[] => {
    const issues: string[] = [];
    if (typeof data !== 'object' || data === null) return ['root must be a JSON object'];
    const obj = data as Record<string, unknown>;
    if (typeof obj.name !== 'string' || obj.name.length === 0) {
        issues.push('"name" is required and must be a non-empty string');
    }
    return issues;
};

/**
 * Validates the Codex plugin manifest.
 * `skills`, `mcpServers`, `apps` are pointers Codex uses to load each integration —
 * they must point at the respective files for set-prompt's Codex integration to work.
 */
const validateCodexPluginManifest = (data: unknown): string[] => {
    const issues: string[] = [];
    if (typeof data !== 'object' || data === null) return ['root must be a JSON object'];
    const obj = data as Record<string, unknown>;
    if (typeof obj.name !== 'string' || obj.name.length === 0) {
        issues.push('"name" is required and must be a non-empty string');
    }
    if (typeof obj.skills !== 'string' || obj.skills.length === 0) {
        issues.push('"skills" is required and must be a string path (e.g. "./skills/")');
    }
    if (typeof obj.mcpServers !== 'string' || obj.mcpServers.length === 0) {
        issues.push('"mcpServers" is required and must be a string path (e.g. "./.mcp.json")');
    }
    if (typeof obj.apps !== 'string' || obj.apps.length === 0) {
        issues.push('"apps" is required and must be a string path (e.g. "./.app.json")');
    }
    return issues;
};

/**
 * If the manifest file exists, parses + validates and returns 'valid' / 'invalid' (never overwrites).
 * Otherwise creates it with `defaultData` and returns 'created'.
 * Validation issues are printed as warnings; the file is left untouched in either case.
 */
const ensureManifest = (
    jsonPath: string,
    metaDir: string,
    validate: (data: unknown) => string[],
    defaultData: object,
    label: string,
): EnsureResult => {
    if (fs.existsSync(jsonPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            const issues = validate(parsed);
            if (issues.length === 0) return 'valid';
            console.warn(chalk.yellow(`  ⚠ ${label} has issues — keeping existing file:`));
            for (const issue of issues) console.warn(chalk.dim(`     ${issue}`));
            return 'invalid';
        } catch (ex: any) {
            console.warn(chalk.yellow(`  ⚠ ${label} failed to parse: ${ex.message} — keeping existing file`));
            return 'invalid';
        }
    }
    fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(defaultData, null, 4), { encoding: 'utf-8' });
    return 'created';
};

export const ensureClaudePluginManifest = (repoPath: string): EnsureResult => {
    const metaDir = path.join(repoPath, '.claude-plugin');
    const jsonPath = path.join(metaDir, 'plugin.json');
    return ensureManifest(jsonPath, metaDir, validateClaudePluginManifest, {
        name: PLUGIN_NAME,
        version: '1.0.0',
        description: 'Managed by set-prompt',
    }, '.claude-plugin/plugin.json');
};

export const ensureCodexPluginManifest = (repoPath: string): EnsureResult => {
    const metaDir = path.join(repoPath, '.codex-plugin');
    const jsonPath = path.join(metaDir, 'plugin.json');
    return ensureManifest(jsonPath, metaDir, validateCodexPluginManifest, {
        name: PLUGIN_NAME,
        version: '1.0.0',
        description: 'Managed by set-prompt',
        skills: './skills/',
        mcpServers: './.mcp.json',
        apps: './.app.json',
    }, '.codex-plugin/plugin.json');
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
        const symFor = (r: EnsureResult): string => (
            r === 'created' ? chalk.green('+')
          : r === 'valid'   ? chalk.dim('✓')
          :                   chalk.yellow('⚠')
        );

        const claudeResult = ensureClaudePluginManifest(targetPath);
        console.log(`${TAB}${symFor(claudeResult)} .claude-plugin/plugin.json`);

        const codexResult = ensureCodexPluginManifest(targetPath);
        console.log(`${TAB}${symFor(codexResult)} .codex-plugin/plugin.json`);

        // ── 5. 설정 파일 (.mcp.json, .app.json) ───────────────────────
        console.log(`${TAB}${ensureMcpJson(targetPath) ? chalk.green('+') : chalk.dim('✓')} .mcp.json`);
        console.log(`${TAB}${ensureAppJson(targetPath) ? chalk.green('+') : chalk.dim('✓')} .app.json`);

        console.log(chalk.green('\nScaffold complete.'));

        // Show a save hint only when scaffolding the registered repo.
        // During `install`, this is a no-op because `configManager.repo_path` isn't set
        // until after `scaffoldCommand` returns — `install` prints its own hint at the end.
        if (
            configManager.repo_path != null
            && path.resolve(targetPath) === path.resolve(configManager.repo_path)
        ) {
            printSaveHint(targetPath);
        }

        return true;
    } catch (ex: any) {
        console.error(chalk.red(`Failed to scaffold repo structure: ${ex.message}`), ex);
        throw ex;
    }
};
