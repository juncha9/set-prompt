import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { CLAUDE_CODE_DIR } from '@/_defs';

vi.mock('fs', async () => {
    const { fs } = await import('memfs');
    return { default: fs, ...fs };
});

vi.mock('fs-extra', () => ({
    pathExists: vi.fn(),
}));

vi.mock('@inquirer/prompts', () => ({
    confirm: vi.fn(),
}));

vi.mock('child_process', () => ({
    spawnSync: vi.fn(),
}));

vi.mock('ora', () => ({
    default: vi.fn(() => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
    })),
}));

vi.mock('@/_libs/config', () => ({
    getConfig: vi.fn(),
}));

const { applyClaudeCode } = await import('@/commands/apply-command');
const { getConfig } = await import('@/_libs/config');
const { pathExists } = await import('fs-extra');
const { confirm } = await import('@inquirer/prompts');
const { spawnSync } = await import('child_process');

describe('applyClaudeCode', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
    });

    it('config 없으면 즉시 종료 (CLAUDE_CODE_DIR 미생성)', async () => {
        vi.mocked(getConfig).mockReturnValue(null);

        await applyClaudeCode();

        expect(() => vol.statSync(CLAUDE_CODE_DIR)).toThrow();
    });

    it('src 디렉토리 없으면 심볼릭 링크 생성 안 함', async () => {
        vi.mocked(getConfig).mockReturnValue({ repo_path: '/my/repo' });
        vi.mocked(pathExists).mockResolvedValue(false);
        vi.mocked(confirm).mockResolvedValue(false);

        await applyClaudeCode();

        // CLAUDE_CODE_DIR은 생성되지만 내부는 비어 있어야 함
        const entries = vol.readdirSync(CLAUDE_CODE_DIR);
        expect(entries).toHaveLength(0);
    });

    it('skills 디렉토리 있으면 심볼릭 링크 생성', async () => {
        const repoPath = '/my/repo';
        vi.mocked(getConfig).mockReturnValue({ repo_path: repoPath });
        vi.mocked(pathExists).mockImplementation(async (p) =>
            p === path.join(repoPath, 'skills'),
        );
        vi.mocked(confirm).mockResolvedValue(false);

        await applyClaudeCode();

        const dest = path.join(CLAUDE_CODE_DIR, 'skills');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
        expect(vol.readlinkSync(dest)).toBe(path.join(repoPath, 'skills'));
    });

    it('여러 디렉토리(skills, commands, hooks) 모두 링크', async () => {
        const repoPath = '/my/repo';
        vi.mocked(getConfig).mockReturnValue({ repo_path: repoPath });
        vi.mocked(pathExists).mockResolvedValue(true);
        vi.mocked(confirm).mockResolvedValue(false);

        await applyClaudeCode();

        for (const dir of ['skills', 'commands', 'hooks']) {
            const dest = path.join(CLAUDE_CODE_DIR, dir);
            expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
        }
    });

    it('dest 이미 존재하면 삭제 후 재링크', async () => {
        const repoPath = '/my/repo';
        vi.mocked(getConfig).mockReturnValue({ repo_path: repoPath });
        vi.mocked(pathExists).mockImplementation(async (p) =>
            p === path.join(repoPath, 'skills'),
        );
        vi.mocked(confirm).mockResolvedValue(false);

        // 기존 디렉토리를 미리 만들어 둠
        vol.fromJSON({
            [path.join(CLAUDE_CODE_DIR, 'skills', 'old-skill.md')]: '# old',
        });

        await applyClaudeCode();

        const dest = path.join(CLAUDE_CODE_DIR, 'skills');
        // 기존 디렉토리가 심볼릭 링크로 교체되어야 함
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('사용자가 install 거부하면 spawnSync 미호출', async () => {
        vi.mocked(getConfig).mockReturnValue({ repo_path: '/my/repo' });
        vi.mocked(pathExists).mockResolvedValue(false);
        vi.mocked(confirm).mockResolvedValue(false);

        await applyClaudeCode();

        expect(spawnSync).not.toHaveBeenCalled();
    });

    it('사용자가 install 확인하면 claude plugin install 실행', async () => {
        vi.mocked(getConfig).mockReturnValue({ repo_path: '/my/repo' });
        vi.mocked(pathExists).mockResolvedValue(false);
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({ status: 0, stderr: null } as any);

        await applyClaudeCode();

        expect(spawnSync).toHaveBeenCalledWith(
            'claude',
            ['plugin', 'install', CLAUDE_CODE_DIR],
            { stdio: 'pipe' },
        );
    });

    it('plugin install 실패 시 에러 표시 (process 종료 안 함)', async () => {
        vi.mocked(getConfig).mockReturnValue({ repo_path: '/my/repo' });
        vi.mocked(pathExists).mockResolvedValue(false);
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({
            status: 1,
            stderr: Buffer.from('command not found'),
        } as any);

        // 에러가 throw되지 않고 gracefully 처리되어야 함
        await expect(applyClaudeCode()).resolves.not.toThrow();
    });
});
