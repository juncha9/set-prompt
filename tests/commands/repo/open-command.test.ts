import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('child_process', () => ({
    spawn: vi.fn(),
    spawnSync: vi.fn(),
}));

vi.mock('fs', () => {
    const existsSync = vi.fn();
    return {
        default: { existsSync },
        existsSync,
    };
});

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
    }
}));

const { repoOpenCommand } = await import('@/commands/repo/open-command');
const { spawn, spawnSync } = await import('child_process');
const fs = await import('fs');
const { configManager } = await import('@/_libs/config');

const makeChild = () => ({
    on: vi.fn(),
    unref: vi.fn(),
} as any);

const probeCmd = process.platform === 'win32' ? 'where' : 'which';

describe('repoOpenCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it('repo_path 미설정 → spawn 미실행', () => {
        configManager.repo_path = null;

        repoOpenCommand();

        expect(spawn).not.toHaveBeenCalled();
    });

    it('기본: 플랫폼 opener로 spawn (detached + unref)', () => {
        configManager.repo_path = '/fake/repo';
        const child = makeChild();
        vi.mocked(spawn).mockReturnValue(child);

        repoOpenCommand();

        const expectedOpener = process.platform === 'win32' ? 'explorer'
                             : process.platform === 'darwin' ? 'open'
                             : 'xdg-open';
        expect(spawn).toHaveBeenCalledWith(
            expectedOpener,
            ['/fake/repo'],
            expect.objectContaining({ detached: true, stdio: 'ignore' }),
        );
        expect(child.unref).toHaveBeenCalled();
    });

    describe('--code', () => {
        it('code CLI 존재 시 `code <path>` 실행', () => {
            configManager.repo_path = '/fake/repo';
            vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);
            const child = makeChild();
            vi.mocked(spawn).mockReturnValue(child);

            repoOpenCommand({ code: true });

            expect(spawnSync).toHaveBeenCalledWith(probeCmd, ['code'], expect.objectContaining({ stdio: 'ignore' }));
            expect(spawn).toHaveBeenCalledWith(
                'code',
                ['/fake/repo'],
                expect.objectContaining({ detached: true, shell: true }),
            );
            expect(child.unref).toHaveBeenCalled();
        });

        it('code CLI 미존재 시 spawn 미실행 + 에러 메시지', () => {
            configManager.repo_path = '/fake/repo';
            vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            repoOpenCommand({ code: true });

            expect(spawn).not.toHaveBeenCalled();
            expect(errSpy.mock.calls.flat().join('')).toContain('not found');
            errSpy.mockRestore();
        });
    });

    describe('--stree', () => {
        it('stree가 PATH에 있으면 `stree <path>` 실행', () => {
            configManager.repo_path = '/fake/repo';
            vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);
            const child = makeChild();
            vi.mocked(spawn).mockReturnValue(child);

            repoOpenCommand({ stree: true });

            expect(spawnSync).toHaveBeenCalledWith(probeCmd, ['stree'], expect.objectContaining({ stdio: 'ignore' }));
            expect(spawn).toHaveBeenCalledWith(
                'stree',
                ['/fake/repo'],
                expect.objectContaining({ detached: true, shell: true }),
            );
        });

        it('Windows: stree 없으면 SourceTree.exe 자동 탐색 후 `-f <path>` 로 실행', () => {
            if (process.platform !== 'win32') {
                // Skip outside Windows — path-based fallback only applies on win32
                return;
            }
            configManager.repo_path = '/fake/repo';
            const exePath = process.env.LOCALAPPDATA + '\\SourceTree\\SourceTree.exe';
            process.env.LOCALAPPDATA = process.env.LOCALAPPDATA ?? 'C:\\Users\\x\\AppData\\Local';

            vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any); // stree not on PATH
            vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('SourceTree.exe'));
            const child = makeChild();
            vi.mocked(spawn).mockReturnValue(child);

            repoOpenCommand({ stree: true });

            expect(spawn).toHaveBeenCalledWith(
                expect.stringContaining('SourceTree.exe'),
                ['-f', '/fake/repo'],
                expect.objectContaining({ detached: true, shell: true }),
            );
        });

        it('stree도 없고 SourceTree.exe도 없으면 spawn 미실행 + 설치 힌트', () => {
            configManager.repo_path = '/fake/repo';
            vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
            vi.mocked(fs.existsSync).mockReturnValue(false);
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            repoOpenCommand({ stree: true });

            expect(spawn).not.toHaveBeenCalled();
            expect(errSpy.mock.calls.flat().join('')).toContain('Sourcetree not found');
            // Hint varies by platform — just verify a hint was logged
            expect(logSpy).toHaveBeenCalled();
            errSpy.mockRestore();
            logSpy.mockRestore();
        });
    });

    it('--code와 --stree 동시 지정 시 --code 우선', () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);
        const child = makeChild();
        vi.mocked(spawn).mockReturnValue(child);

        repoOpenCommand({ code: true, stree: true });

        expect(spawnSync).toHaveBeenCalledWith(probeCmd, ['code'], expect.anything());
        expect(spawnSync).not.toHaveBeenCalledWith(probeCmd, ['stree'], expect.anything());
        expect(spawn).toHaveBeenCalledWith('code', expect.anything(), expect.anything());
    });
});
