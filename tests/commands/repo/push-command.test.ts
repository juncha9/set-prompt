import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('child_process', () => ({ spawnSync: vi.fn() }));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        remote_url: null,
    }
}));

const { repoPushCommand } = await import('@/commands/repo/push-command');
const { spawnSync } = await import('child_process');
const { configManager } = await import('@/_libs/config');

describe('repoPushCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('repo_path 미설정 → git 미실행, false', () => {
        configManager.repo_path = null;
        configManager.remote_url = 'https://github.com/foo/bar.git';

        const result = repoPushCommand();

        expect(spawnSync).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('remote_url 미설정 → git 미실행, false', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = null;

        const result = repoPushCommand();

        expect(spawnSync).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('성공 시 git push 실행, true 반환', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = 'https://github.com/foo/bar.git';
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        const result = repoPushCommand();

        expect(spawnSync).toHaveBeenCalledExactlyOnceWith('git', ['push'], { cwd: '/fake/repo', stdio: 'inherit' });
        expect(result).toBe(true);
    });

    it('push 실패 → false 반환 + 에러 출력', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = 'https://github.com/foo/bar.git';
        vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);

        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = repoPushCommand();

        expect(result).toBe(false);
        expect(errSpy.mock.calls.flat().join('')).toContain('push failed');
        errSpy.mockRestore();
    });
});
