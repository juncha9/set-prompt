import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import os from 'os';
import { CLAUDE_CODE_DIR, ROO_DIR, ROO_BACKUP_DIR, OPENCLAW_DIR } from '@/_defs';

vi.mock('fs', async () => {
    const { fs } = await import('memfs');
    return { default: fs, ...fs };
});

vi.mock('fs-extra', () => ({
    pathExists: vi.fn(),
}));

vi.mock('@inquirer/prompts', () => ({
    confirm: vi.fn(),
    checkbox: vi.fn(),
}));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        remote_url: null,
        claude_code: null,
        roocode: null,
        openclaw: null,
        save: vi.fn(),
        isClaudeCodeEnabled: vi.fn().mockReturnValue(false),
        isRooCodeEnabled: vi.fn().mockReturnValue(false),
        isOpenclawEnabled: vi.fn().mockReturnValue(false),
    }
}));

const { linkClaudeCode, linkRooCode, linkOpenclaw } = await import('@/commands/link-command');
const { configManager } = await import('@/_libs/config');
const { pathExists } = await import('fs-extra');

describe('linkClaudeCode', () => {
    beforeEach(() => {
        vol.reset();
        // memfs에 ~/.claude 경로 생성
        vol.mkdirSync(path.join(os.homedir(), '.claude'), { recursive: true });
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → CLAUDE_CODE_DIR 미생성', async () => {
        configManager.repo_path = null;

        await linkClaudeCode();

        expect(vol.existsSync(CLAUDE_CODE_DIR)).toBe(false);
    });

    it('repo_path 설정 → CLAUDE_CODE_DIR 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkClaudeCode();

        expect(vol.existsSync(CLAUDE_CODE_DIR)).toBe(true);
    });

    it('marketplace.json, plugin.json 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkClaudeCode();

        const marketplacePath = path.join(CLAUDE_CODE_DIR, '.claude-plugin', 'marketplace.json');
        const pluginPath = path.join(CLAUDE_CODE_DIR, 'plugins', 'set-prompt', '.claude-plugin', 'plugin.json');

        expect(vol.existsSync(marketplacePath)).toBe(true);
        expect(vol.existsSync(pluginPath)).toBe(true);
    });

    it('skills 디렉토리 존재 시 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({ [`${repoPath}/skills/test.md`]: 'test' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkClaudeCode();

        const dest = path.join(CLAUDE_CODE_DIR, 'plugins', 'set-prompt', 'skills');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('dest 이미 존재하면 삭제 후 재링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({ [`${repoPath}/skills/test.md`]: 'test' });
        const dest = path.join(CLAUDE_CODE_DIR, 'plugins', 'set-prompt', 'skills');
        vol.mkdirSync(dest, { recursive: true });

        vi.mocked(pathExists).mockResolvedValue(true);

        await linkClaudeCode();

        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('성공 시 configManager.claude_code에 path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkClaudeCode();

        expect(configManager.claude_code).toEqual({ path: CLAUDE_CODE_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

describe('linkRooCode', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → ROO_DIR 미생성', async () => {
        configManager.repo_path = null;

        await linkRooCode();

        expect(vol.existsSync(ROO_DIR)).toBe(false);
    });

    it('repo_path 설정 → ROO_DIR 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkRooCode();

        expect(vol.existsSync(ROO_DIR)).toBe(true);
    });

    it('skills, commands 디렉토리 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({
            [`${repoPath}/skills/test.md`]: 'test',
            [`${repoPath}/commands/test.md`]: 'test',
        });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkRooCode();

        expect(vol.lstatSync(path.join(ROO_DIR, 'skills')).isSymbolicLink()).toBe(true);
        expect(vol.lstatSync(path.join(ROO_DIR, 'commands')).isSymbolicLink()).toBe(true);
    });

    it('hooks 디렉토리는 링크하지 않음', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({ [`${repoPath}/hooks/test.md`]: 'test' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkRooCode();

        expect(vol.existsSync(path.join(ROO_DIR, 'hooks'))).toBe(false);
    });

    it('기존 디렉토리 백업 후 링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.mkdirSync(path.join(ROO_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(ROO_DIR, 'skills', 'existing.md'), 'existing');
        vol.fromJSON({ [`${repoPath}/skills/new.md`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkRooCode();

        expect(vol.lstatSync(path.join(ROO_DIR, 'skills')).isSymbolicLink()).toBe(true);
        expect(vol.existsSync(path.join(ROO_BACKUP_DIR, 'skills', 'existing.md'))).toBe(true);
    });

    it('성공 시 configManager.roocode에 path, backup_path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkRooCode();

        expect(configManager.roocode).toEqual({ path: ROO_DIR, backup_path: ROO_BACKUP_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

describe('linkOpenclaw', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → OPENCLAW_DIR 미생성', async () => {
        configManager.repo_path = null;

        await linkOpenclaw();

        expect(vol.existsSync(OPENCLAW_DIR)).toBe(false);
    });

    it('repo_path 설정 → OPENCLAW_DIR 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkOpenclaw();

        expect(vol.existsSync(OPENCLAW_DIR)).toBe(true);
    });

    it('skills 디렉토리 존재 시 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({ [`${repoPath}/skills/test.md`]: 'test' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkOpenclaw();

        const dest = path.join(OPENCLAW_DIR, 'skills');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('commands 디렉토리는 링크하지 않음', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({
            [`${repoPath}/skills/test.md`]: 'test',
            [`${repoPath}/commands/test.md`]: 'test',
        });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkOpenclaw();

        expect(vol.existsSync(path.join(OPENCLAW_DIR, 'commands'))).toBe(false);
    });

    it('기존 skills 디렉토리 백업 후 링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.mkdirSync(path.join(OPENCLAW_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(OPENCLAW_DIR, 'skills', 'existing.md'), 'existing');
        vol.fromJSON({ [`${repoPath}/skills/new.md`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkOpenclaw();

        const dest = path.join(OPENCLAW_DIR, 'skills');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('성공 시 configManager.openclaw에 path, backup_path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkOpenclaw();

        expect(configManager.openclaw).toMatchObject({ path: OPENCLAW_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});
