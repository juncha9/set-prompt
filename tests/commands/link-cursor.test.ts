import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { CURSOR_DIR } from '@/_defs';

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

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        cursor: null,
        save: vi.fn(),
    }
}));

const { linkCursor, unlinkCursor } = await import('@/link/cursor');
const { configManager } = await import('@/_libs/config');
const { confirm } = await import('@inquirer/prompts');
const { pathExists } = await import('fs-extra');

const CURSOR_BACKUP_DIR = path.join(CURSOR_DIR, 'SET_PROMPT_BACKUP');

describe('linkCursor', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → symlink 미생성', async () => {
        configManager.repo_path = null;
        await linkCursor();
        expect(vol.existsSync(path.join(CURSOR_DIR, 'skills'))).toBe(false);
    });

    it('skills symlink 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vol.fromJSON({ ['/fake/repo/skills/test.md']: 'test' });
        vol.mkdirSync(CURSOR_DIR, { recursive: true });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkCursor();

        expect(vol.lstatSync(path.join(CURSOR_DIR, 'skills')).isSymbolicLink()).toBe(true);
    });

    it('기존 디렉토리 백업 후 링크', async () => {
        configManager.repo_path = '/fake/repo';
        vol.mkdirSync(path.join(CURSOR_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(CURSOR_DIR, 'skills', 'existing.md'), 'existing');
        vol.fromJSON({ ['/fake/repo/skills/new.md']: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);
        vi.mocked(confirm).mockResolvedValue(true);

        await linkCursor();

        expect(vol.lstatSync(path.join(CURSOR_DIR, 'skills')).isSymbolicLink()).toBe(true);
        expect(vol.existsSync(path.join(CURSOR_BACKUP_DIR, 'skills', 'existing.md'))).toBe(true);
    });

    it('성공 시 configManager.cursor에 path, backup_path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkCursor();

        expect(configManager.cursor).toEqual({ path: CURSOR_DIR, backup_path: CURSOR_BACKUP_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

describe('unlinkCursor', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        configManager.cursor = null;
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('force=false, 사용자 취소 → symlink 유지', async () => {
        vol.mkdirSync(CURSOR_DIR, { recursive: true });
        vol.mkdirSync('/fake/repo/skills', { recursive: true });
        vol.symlinkSync('/fake/repo/skills', path.join(CURSOR_DIR, 'skills'));
        vi.mocked(confirm).mockResolvedValue(false);

        await unlinkCursor(false);

        expect(vol.lstatSync(path.join(CURSOR_DIR, 'skills')).isSymbolicLink()).toBe(true);
    });

    it('force=true → symlink 제거', async () => {
        vol.mkdirSync(CURSOR_DIR, { recursive: true });
        vol.mkdirSync('/fake/repo/skills', { recursive: true });
        vol.symlinkSync('/fake/repo/skills', path.join(CURSOR_DIR, 'skills'));

        await unlinkCursor(true);

        expect(confirm).not.toHaveBeenCalled();
        expect(vol.existsSync(path.join(CURSOR_DIR, 'skills'))).toBe(false);
    });

    it('백업 존재 → 복원', async () => {
        configManager.cursor = { path: CURSOR_DIR, backup_path: CURSOR_BACKUP_DIR };
        vol.mkdirSync(CURSOR_DIR, { recursive: true });
        vol.mkdirSync(path.join(CURSOR_BACKUP_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(CURSOR_BACKUP_DIR, 'skills', 'original.md'), 'backup');
        vol.mkdirSync('/fake/repo/skills', { recursive: true });
        vol.symlinkSync('/fake/repo/skills', path.join(CURSOR_DIR, 'skills'));

        await unlinkCursor(true);

        expect(vol.existsSync(path.join(CURSOR_DIR, 'skills', 'original.md'))).toBe(true);
    });

    it('성공 시 configManager.cursor = null, save 호출', async () => {
        await unlinkCursor(true);
        expect(configManager.cursor).toBeNull();
        expect(configManager.save).toHaveBeenCalled();
    });
});
