import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('child_process', () => ({ spawnSync: vi.fn() }));

const { generateCommitMessage } = await import('@/_libs/repo');
const { spawnSync } = await import('child_process');

const mockStatus = (stdout: string, status = 0): void => {
    vi.mocked(spawnSync).mockReturnValue({ status, stdout } as any);
};

describe('generateCommitMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('git 실패 → null', () => {
        mockStatus('', 1);
        expect(generateCommitMessage('/fake')).toBeNull();
    });

    it('git status 호출 시 --untracked-files=all 플래그 사용', () => {
        // Regression guard: without this flag, git rolls up untracked directories
        // into a single entry instead of listing individual files inside them.
        mockStatus('');
        generateCommitMessage('/fake');
        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            ['status', '--porcelain', '--untracked-files=all'],
            expect.objectContaining({ cwd: '/fake' }),
        );
    });

    it('변경 없음 → null', () => {
        mockStatus('');
        expect(generateCommitMessage('/fake')).toBeNull();
    });

    it('전부 수정 → "update N files" 서브젝트 + 줄바꿈 본문', () => {
        mockStatus(' M skills/foo.md\n M commands/bar.md\n');
        expect(generateCommitMessage('/fake')).toBe(
            'update 2 files\n\n' +
            '- skills/foo.md\n' +
            '- commands/bar.md'
        );
    });

    it('단수형: 1개 → "file"', () => {
        mockStatus(' M skills/foo.md\n');
        expect(generateCommitMessage('/fake')).toBe(
            'update 1 file\n\n' +
            '- skills/foo.md'
        );
    });

    it('전부 추가(staged) → "add N files"', () => {
        mockStatus('A  skills/foo.md\nA  skills/bar.md\n');
        expect(generateCommitMessage('/fake')).toBe(
            'add 2 files\n\n' +
            '- skills/foo.md\n' +
            '- skills/bar.md'
        );
    });

    it('untracked 파일도 add로 분류', () => {
        mockStatus('?? skills/new.md\n');
        expect(generateCommitMessage('/fake')).toBe(
            'add 1 file\n\n' +
            '- skills/new.md'
        );
    });

    it('전부 삭제 → "remove N files"', () => {
        mockStatus(' D skills/old.md\n D commands/obsolete.md\n');
        expect(generateCommitMessage('/fake')).toBe(
            'remove 2 files\n\n' +
            '- skills/old.md\n' +
            '- commands/obsolete.md'
        );
    });

    it('추가 + 수정 섞임 → "update N files"', () => {
        mockStatus('A  skills/new.md\n M skills/existing.md\n');
        expect(generateCommitMessage('/fake')).toBe(
            'update 2 files\n\n' +
            '- skills/new.md\n' +
            '- skills/existing.md'
        );
    });

    it('파일 많아도 전부 표시 (truncation 없음)', () => {
        mockStatus(' M a.md\n M b.md\n M c.md\n M d.md\n M e.md\n');
        expect(generateCommitMessage('/fake')).toBe(
            'update 5 files\n\n' +
            '- a.md\n' +
            '- b.md\n' +
            '- c.md\n' +
            '- d.md\n' +
            '- e.md'
        );
    });

    it('rename → new path 사용', () => {
        mockStatus('R  old/path.md -> new/path.md\n');
        expect(generateCommitMessage('/fake')).toBe(
            'update 1 file\n\n' +
            '- new/path.md'
        );
    });

    it('따옴표 감싸진 경로 처리', () => {
        mockStatus(' M "skills/with space.md"\n');
        expect(generateCommitMessage('/fake')).toBe(
            'update 1 file\n\n' +
            '- skills/with space.md'
        );
    });

    it('basename 중복 파일도 전체 경로로 구분됨', () => {
        mockStatus(' M skills/a/SKILL.md\n M skills/b/SKILL.md\n');
        expect(generateCommitMessage('/fake')).toBe(
            'update 2 files\n\n' +
            '- skills/a/SKILL.md\n' +
            '- skills/b/SKILL.md'
        );
    });
});
