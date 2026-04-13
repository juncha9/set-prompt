import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('child_process', () => ({ spawnSync: vi.fn() }));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
    }
}));

const { repoStatusCommand } = await import('@/commands/repo/status-command');
const { spawnSync } = await import('child_process');
const { configManager } = await import('@/_libs/config');

const mockStatus = (stdout: string, status = 0): void => {
    vi.mocked(spawnSync).mockReturnValue({ status, stdout, stderr: '' } as any);
};

const captureLogs = (): { get: () => string; restore: () => void } => {
    const chunks: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
        chunks.push(args.join(' '));
    });
    return {
        get: () => chunks.join('\n'),
        restore: () => spy.mockRestore(),
    };
};

describe('repoStatusCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('repo_path 미설정 → git 미실행', () => {
        configManager.repo_path = null;

        repoStatusCommand();

        expect(spawnSync).not.toHaveBeenCalled();
    });

    it('git status 호출 시 --porcelain=v1 + --branch + --untracked-files=all 사용', () => {
        // Regression guard: --untracked-files=all is what makes files inside
        // new directories show individually instead of collapsing to the dir.
        configManager.repo_path = '/fake/repo';
        mockStatus('## main...origin/main\n');

        const logs = captureLogs();
        repoStatusCommand();
        logs.restore();

        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            ['status', '--porcelain=v1', '--branch', '--untracked-files=all'],
            expect.objectContaining({ cwd: '/fake/repo' }),
        );
    });

    it('clean → "Working tree clean" 출력', () => {
        configManager.repo_path = '/fake/repo';
        mockStatus('## main...origin/main\n');

        const logs = captureLogs();
        repoStatusCommand();
        const out = logs.get();
        logs.restore();

        expect(out).toContain('main');
        expect(out).toContain('origin/main');
        expect(out).toContain('Working tree clean');
    });

    it('ahead/behind 파싱', () => {
        configManager.repo_path = '/fake/repo';
        mockStatus('## main...origin/main [ahead 2, behind 1]\n');

        const logs = captureLogs();
        repoStatusCommand();
        const out = logs.get();
        logs.restore();

        expect(out).toContain('ahead 2');
        expect(out).toContain('behind 1');
    });

    it('upstream 없음 → "(no upstream)"', () => {
        configManager.repo_path = '/fake/repo';
        mockStatus('## feature\n');

        const logs = captureLogs();
        repoStatusCommand();
        const out = logs.get();
        logs.restore();

        expect(out).toContain('feature');
        expect(out).toContain('no upstream');
    });

    it('detached HEAD 처리', () => {
        configManager.repo_path = '/fake/repo';
        mockStatus('## HEAD (no branch)\n');

        const logs = captureLogs();
        repoStatusCommand();
        const out = logs.get();
        logs.restore();

        expect(out).toContain('detached HEAD');
    });

    it('변경 파일 목록 출력 (label + path)', () => {
        configManager.repo_path = '/fake/repo';
        mockStatus(
            '## main...origin/main\n' +
            ' M skills/foo.md\n' +
            'A  skills/new.md\n' +
            ' D old.md\n' +
            '?? draft.md\n'
        );

        const logs = captureLogs();
        repoStatusCommand();
        const out = logs.get();
        logs.restore();

        expect(out).toContain('Changes (4)');
        expect(out).toContain('modified');
        expect(out).toContain('skills/foo.md');
        expect(out).toContain('added');
        expect(out).toContain('skills/new.md');
        expect(out).toContain('deleted');
        expect(out).toContain('old.md');
        expect(out).toContain('untracked');
        expect(out).toContain('draft.md');
    });

    it('rename → new path 표시', () => {
        configManager.repo_path = '/fake/repo';
        mockStatus(
            '## main...origin/main\n' +
            'R  old/path.md -> new/path.md\n'
        );

        const logs = captureLogs();
        repoStatusCommand();
        const out = logs.get();
        logs.restore();

        expect(out).toContain('renamed');
        expect(out).toContain('new/path.md');
        expect(out).not.toContain('old/path.md');
    });

    it('git 실패 → 에러 출력', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(spawnSync).mockReturnValue({ status: 1, stdout: '', stderr: 'fatal: not a git repo' } as any);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        repoStatusCommand();

        expect(errSpy.mock.calls.flat().join('')).toContain('git status failed');
        errSpy.mockRestore();
    });
});
