import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('child_process', () => ({ spawnSync: vi.fn() }));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        remote_url: null,
    }
}));

const { repoPullCommand } = await import('@/commands/repo/pull-command');
const { spawnSync } = await import('child_process');
const { configManager } = await import('@/_libs/config');

describe('repoPullCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('repo_path 미설정 → git 미실행', () => {
        configManager.repo_path = null;
        configManager.remote_url = 'https://github.com/foo/bar.git';

        repoPullCommand();

        expect(spawnSync).not.toHaveBeenCalled();
    });

    it('remote_url 미설정 → git 미실행', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = null;

        repoPullCommand();

        expect(spawnSync).not.toHaveBeenCalled();
    });

    it('fetch 후 pull 순서로 실행', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = 'https://github.com/foo/bar.git';
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        repoPullCommand();

        expect(spawnSync).toHaveBeenNthCalledWith(1, 'git', ['fetch'], { cwd: '/fake/repo', stdio: 'inherit' });
        expect(spawnSync).toHaveBeenNthCalledWith(2, 'git', ['pull'],  { cwd: '/fake/repo', stdio: 'inherit' });
    });

    it('fetch 실패 → pull 미실행', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = 'https://github.com/foo/bar.git';
        vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);

        repoPullCommand();

        expect(spawnSync).toHaveBeenCalledTimes(1);
        expect(spawnSync).toHaveBeenCalledWith('git', ['fetch'], expect.anything());
    });

    it('pull 실패 → 에러 메시지 출력', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = 'https://github.com/foo/bar.git';
        vi.mocked(spawnSync)
            .mockReturnValueOnce({ status: 0 } as any)
            .mockReturnValueOnce({ status: 1 } as any);

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        repoPullCommand();

        expect(consoleSpy.mock.calls.flat().join('')).toContain('pull failed');
        consoleSpy.mockRestore();
    });

    it('성공 시 "Repo pulled." 출력', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = 'https://github.com/foo/bar.git';
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        repoPullCommand();

        expect(consoleSpy.mock.calls.flat().join('')).toContain('Repo pulled');
        consoleSpy.mockRestore();
    });
});
