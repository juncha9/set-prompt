import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { ROO_DIR, ROO_BACKUP_DIR } from '@/_defs';

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
        roocode: null,
        save: vi.fn(),
    }
}));

const { linkRooCode, unlinkRooCode } = await import('@/link/roocode');
const { configManager } = await import('@/_libs/config');
const { confirm } = await import('@inquirer/prompts');
const { pathExists } = await import('fs-extra');

describe('linkRooCode', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → ROO_DIR 미생성', async () => {
        configManager.repo_path = null;
        await linkRooCode();
        expect(vol.existsSync(ROO_DIR)).toBe(false);
    });

    it('repo_path 설정 → ROO_DIR 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);
        await linkRooCode();
        expect(vol.existsSync(ROO_DIR)).toBe(true);
    });

    it('skills, commands 디렉토리 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.fromJSON({
            [`${repoPath}/skills/test.md`]: 'test',
            [`${repoPath}/commands/test.md`]: 'test',
        });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkRooCode();

        expect(vol.lstatSync(path.join(ROO_DIR, 'skills')).isSymbolicLink()).toBe(true);
        expect(vol.lstatSync(path.join(ROO_DIR, 'commands')).isSymbolicLink()).toBe(true);
    });

    it('hooks 디렉토리는 링크하지 않음', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.fromJSON({ [`${repoPath}/hooks/test.md`]: 'test' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkRooCode();

        expect(vol.existsSync(path.join(ROO_DIR, 'hooks'))).toBe(false);
    });

    it('기존 디렉토리 백업 후 링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.mkdirSync(path.join(ROO_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(ROO_DIR, 'skills', 'existing.md'), 'existing');
        vol.fromJSON({ [`${repoPath}/skills/new.md`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);
        vi.mocked(confirm).mockResolvedValue(true);

        await linkRooCode();

        expect(vol.lstatSync(path.join(ROO_DIR, 'skills')).isSymbolicLink()).toBe(true);
        expect(vol.existsSync(path.join(ROO_BACKUP_DIR, 'skills', 'existing.md'))).toBe(true);
    });

    it('성공 시 configManager.roocode에 path, backup_path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);
        await linkRooCode();
        expect(configManager.roocode).toEqual({ path: ROO_DIR, backup_path: ROO_BACKUP_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

describe('unlinkRooCode', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        configManager.roocode = null;
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('force=false, 사용자 취소 → 심볼릭 링크 유지', async () => {
        vol.mkdirSync(ROO_DIR, { recursive: true });
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(ROO_DIR, 'skills'));
        vi.mocked(confirm).mockResolvedValue(false);

        await unlinkRooCode(false);

        expect(vol.lstatSync(path.join(ROO_DIR, 'skills')).isSymbolicLink()).toBe(true);
    });

    it('force=true → confirm 없이 심볼릭 링크 제거', async () => {
        vol.mkdirSync(ROO_DIR, { recursive: true });
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(ROO_DIR, 'skills'));

        await unlinkRooCode(true);

        expect(confirm).not.toHaveBeenCalled();
        expect(vol.existsSync(path.join(ROO_DIR, 'skills'))).toBe(false);
    });

    it('백업 존재 → 복원', async () => {
        configManager.roocode = { path: ROO_DIR, backup_path: ROO_BACKUP_DIR };
        vol.mkdirSync(ROO_DIR, { recursive: true });
        vol.mkdirSync(path.join(ROO_BACKUP_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(ROO_BACKUP_DIR, 'skills', 'original.md'), 'backup');
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(ROO_DIR, 'skills'));

        await unlinkRooCode(true);

        expect(vol.existsSync(path.join(ROO_DIR, 'skills', 'original.md'))).toBe(true);
    });

    it('성공 시 configManager.roocode = null, save 호출', async () => {
        await unlinkRooCode(true);
        expect(configManager.roocode).toBeNull();
        expect(configManager.save).toHaveBeenCalled();
    });
});
