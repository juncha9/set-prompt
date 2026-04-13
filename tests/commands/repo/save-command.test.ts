import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/commands/repo/commit-command', () => ({
    repoCommitCommand: vi.fn(),
}));
vi.mock('@/commands/repo/push-command', () => ({
    repoPushCommand: vi.fn(),
}));

const { repoSaveCommand } = await import('@/commands/repo/save-command');
const { repoCommitCommand } = await import('@/commands/repo/commit-command');
const { repoPushCommand } = await import('@/commands/repo/push-command');

describe('repoSaveCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('commit 성공 → push 호출', () => {
        vi.mocked(repoCommitCommand).mockReturnValue(true);
        vi.mocked(repoPushCommand).mockReturnValue(true);

        repoSaveCommand({ message: 'msg' });

        expect(repoCommitCommand).toHaveBeenCalledExactlyOnceWith({ message: 'msg' });
        expect(repoPushCommand).toHaveBeenCalledOnce();
    });

    it('commit 실패 → push 미호출', () => {
        vi.mocked(repoCommitCommand).mockReturnValue(false);

        repoSaveCommand({ message: 'msg' });

        expect(repoCommitCommand).toHaveBeenCalledOnce();
        expect(repoPushCommand).not.toHaveBeenCalled();
    });
});
