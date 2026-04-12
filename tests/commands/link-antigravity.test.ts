import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { ANTIGRAVITY_DIR, ANTIGRAVITY_BACKUP_DIR } from '@/_defs';

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
        antigravity: null,
        save: vi.fn(),
    }
}));

const { linkAntigravity, unlinkAntigravity } = await import('@/link/antigravity');
const { configManager } = await import('@/_libs/config');
const { confirm } = await import('@inquirer/prompts');
const { pathExists } = await import('fs-extra');

describe('linkAntigravity', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → ANTIGRAVITY_DIR 미생성', async () => {
        configManager.repo_path = null;
        await linkAntigravity();
        expect(vol.existsSync(ANTIGRAVITY_DIR)).toBe(false);
    });

    it('repo_path 설정 → ANTIGRAVITY_DIR 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);
        await linkAntigravity();
        expect(vol.existsSync(ANTIGRAVITY_DIR)).toBe(true);
    });

    it('skills 디렉토리 존재 시 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.fromJSON({ [`${repoPath}/skills/test.md`]: 'test' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkAntigravity();

        expect(vol.lstatSync(path.join(ANTIGRAVITY_DIR, 'skills')).isSymbolicLink()).toBe(true);
    });

    it('commands 디렉토리는 링크하지 않음', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.fromJSON({
            [`${repoPath}/skills/test.md`]: 'test',
            [`${repoPath}/commands/test.md`]: 'test',
        });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkAntigravity();

        expect(vol.existsSync(path.join(ANTIGRAVITY_DIR, 'commands'))).toBe(false);
    });

    it('기존 skills 디렉토리 백업 후 링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.mkdirSync(path.join(ANTIGRAVITY_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(ANTIGRAVITY_DIR, 'skills', 'existing.md'), 'existing');
        vol.fromJSON({ [`${repoPath}/skills/new.md`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);
        vi.mocked(confirm).mockResolvedValue(true);

        await linkAntigravity();

        expect(vol.lstatSync(path.join(ANTIGRAVITY_DIR, 'skills')).isSymbolicLink()).toBe(true);
        expect(vol.existsSync(path.join(ANTIGRAVITY_BACKUP_DIR, 'skills', 'existing.md'))).toBe(true);
    });

    it('dest 이미 심볼릭 링크이면 백업 없이 재링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.mkdirSync(ANTIGRAVITY_DIR, { recursive: true });
        vol.symlinkSync('/old/skills', path.join(ANTIGRAVITY_DIR, 'skills'));
        vol.fromJSON({ [`${repoPath}/skills/new.md`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkAntigravity();

        expect(vol.existsSync(ANTIGRAVITY_BACKUP_DIR)).toBe(false);
        expect(vol.lstatSync(path.join(ANTIGRAVITY_DIR, 'skills')).isSymbolicLink()).toBe(true);
    });

    it('성공 시 configManager.antigravity에 path, backup_path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);
        await linkAntigravity();
        expect(configManager.antigravity).toEqual({ path: ANTIGRAVITY_DIR, backup_path: ANTIGRAVITY_BACKUP_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

describe('unlinkAntigravity', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        configManager.antigravity = null;
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('force=true → confirm 없이 심볼릭 링크 제거', async () => {
        vol.mkdirSync(ANTIGRAVITY_DIR, { recursive: true });
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(ANTIGRAVITY_DIR, 'skills'));

        await unlinkAntigravity(true);

        expect(confirm).not.toHaveBeenCalled();
        expect(vol.existsSync(path.join(ANTIGRAVITY_DIR, 'skills'))).toBe(false);
    });

    it('백업 존재 → 복원', async () => {
        configManager.antigravity = { path: ANTIGRAVITY_DIR, backup_path: ANTIGRAVITY_BACKUP_DIR };
        vol.mkdirSync(ANTIGRAVITY_DIR, { recursive: true });
        vol.mkdirSync(path.join(ANTIGRAVITY_BACKUP_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(ANTIGRAVITY_BACKUP_DIR, 'skills', 'original.md'), 'backup');
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(ANTIGRAVITY_DIR, 'skills'));

        await unlinkAntigravity(true);

        expect(vol.existsSync(path.join(ANTIGRAVITY_DIR, 'skills', 'original.md'))).toBe(true);
    });

    it('성공 시 configManager.antigravity = null, save 호출', async () => {
        await unlinkAntigravity(true);
        expect(configManager.antigravity).toBeNull();
        expect(configManager.save).toHaveBeenCalled();
    });
});
