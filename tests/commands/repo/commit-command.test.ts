import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('child_process', () => ({ spawnSync: vi.fn() }));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        remote_url: null,
    }
}));

vi.mock('@/_libs/repo', () => ({
    generateCommitMessage: vi.fn(),
}));

const { repoCommitCommand } = await import('@/commands/repo/commit-command');
const { spawnSync } = await import('child_process');
const { configManager } = await import('@/_libs/config');
const { generateCommitMessage } = await import('@/_libs/repo');

describe('repoCommitCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('repo_path 미설정 → git 미실행, false 반환', () => {
        configManager.repo_path = null;

        const result = repoCommitCommand({ message: 'test' });

        expect(spawnSync).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('성공 경로: add → commit (push는 안 함)', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        const result = repoCommitCommand({ message: 'edit skill' });

        expect(spawnSync).toHaveBeenCalledTimes(2);
        expect(spawnSync).toHaveBeenNthCalledWith(1, 'git', ['add', '-A'], { cwd: '/fake/repo', stdio: 'inherit' });
        expect(spawnSync).toHaveBeenNthCalledWith(2, 'git', ['commit', '-m', 'edit skill'], { cwd: '/fake/repo', stdio: 'inherit' });
        expect(result).toBe(true);
    });

    it('add 실패 → commit 미실행, false 반환', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);

        const result = repoCommitCommand({ message: 'x' });

        expect(spawnSync).toHaveBeenCalledTimes(1);
        expect(result).toBe(false);
    });

    it('commit 실패 → false 반환', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(spawnSync)
            .mockReturnValueOnce({ status: 0 } as any)  // add
            .mockReturnValueOnce({ status: 1 } as any); // commit

        const result = repoCommitCommand({ message: 'x' });

        expect(spawnSync).toHaveBeenCalledTimes(2);
        expect(result).toBe(false);
    });

    it('push는 이 명령어에서 절대 호출되지 않음', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        repoCommitCommand({ message: 'x' });

        const pushCall = vi.mocked(spawnSync).mock.calls.find(
            (args) => Array.isArray(args[1]) && (args[1] as string[]).includes('push'),
        );
        expect(pushCall).toBeUndefined();
    });

    it('-m 생략 → 자동 생성된 메시지 사용', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(generateCommitMessage).mockReturnValue('update: foo.md, bar.md');
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        const result = repoCommitCommand();

        expect(generateCommitMessage).toHaveBeenCalledWith('/fake/repo');
        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            ['commit', '-m', 'update: foo.md, bar.md'],
            expect.anything(),
        );
        expect(result).toBe(true);
    });

    it('-m 빈 문자열 → 자동 생성된 메시지 사용', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(generateCommitMessage).mockReturnValue('update: x.md');
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        repoCommitCommand({ message: '   ' });

        expect(generateCommitMessage).toHaveBeenCalled();
        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            ['commit', '-m', 'update: x.md'],
            expect.anything(),
        );
    });

    it('-m 생략 + 변경 없음 → git 미실행, false', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(generateCommitMessage).mockReturnValue(null);

        const result = repoCommitCommand();

        expect(spawnSync).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('-m 제공 시 → 자동 생성기 호출 안 함', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        repoCommitCommand({ message: 'my msg' });

        expect(generateCommitMessage).not.toHaveBeenCalled();
    });
});
