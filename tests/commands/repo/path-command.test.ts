import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
    }
}));

const { repoPathCommand } = await import('@/commands/repo/path-command');
const { configManager } = await import('@/_libs/config');

describe('repoPathCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.exitCode = 0;
    });

    it('repo_path 미설정 → stderr 에러, exitCode=1', () => {
        configManager.repo_path = null;
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const outSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        repoPathCommand();

        expect(errSpy).toHaveBeenCalled();
        expect(outSpy).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);

        errSpy.mockRestore();
        outSpy.mockRestore();
    });

    it('repo_path 설정 → stdout에 경로만 출력 (장식 없음)', () => {
        configManager.repo_path = '/fake/repo';
        const outSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        repoPathCommand();

        expect(outSpy).toHaveBeenCalledExactlyOnceWith('/fake/repo');
        expect(process.exitCode).toBe(0);

        outSpy.mockRestore();
    });
});
