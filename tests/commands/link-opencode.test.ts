import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { OPENCODE_DIR, OPENCODE_BACKUP_DIR } from '@/_defs';

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
        opencode: null,
        save: vi.fn(),
    }
}));

const { linkOpencode, unlinkOpencode } = await import('@/link/opencode');
const { configManager } = await import('@/_libs/config');
const { confirm } = await import('@inquirer/prompts');
const { pathExists } = await import('fs-extra');

describe('linkOpencode', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → OPENCODE_DIR 미생성', async () => {
        configManager.repo_path = null;
        await linkOpencode();
        expect(vol.existsSync(OPENCODE_DIR)).toBe(false);
    });

    it('repo_path 설정 → OPENCODE_DIR 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);
        await linkOpencode();
        expect(vol.existsSync(OPENCODE_DIR)).toBe(true);
    });

    it('skills/commands/agents 디렉토리 존재 시 모두 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.fromJSON({
            [`${repoPath}/skills/test.md`]: 'test',
            [`${repoPath}/commands/test.md`]: 'test',
            [`${repoPath}/agents/test.md`]: 'test',
        });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkOpencode();

        expect(vol.lstatSync(path.join(OPENCODE_DIR, 'skills')).isSymbolicLink()).toBe(true);
        expect(vol.lstatSync(path.join(OPENCODE_DIR, 'commands')).isSymbolicLink()).toBe(true);
        expect(vol.lstatSync(path.join(OPENCODE_DIR, 'agents')).isSymbolicLink()).toBe(true);
    });

    it('hooks 디렉토리는 링크하지 않음 (OpenCode 미지원)', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.fromJSON({
            [`${repoPath}/skills/test.md`]: 'test',
            [`${repoPath}/hooks/test.sh`]: 'test',
        });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkOpencode();

        expect(vol.existsSync(path.join(OPENCODE_DIR, 'hooks'))).toBe(false);
    });

    it('기존 skills 디렉토리 백업 후 링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.mkdirSync(path.join(OPENCODE_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(OPENCODE_DIR, 'skills', 'existing.md'), 'existing');
        vol.fromJSON({ [`${repoPath}/skills/new.md`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);
        vi.mocked(confirm).mockResolvedValue(true);

        await linkOpencode();

        expect(vol.lstatSync(path.join(OPENCODE_DIR, 'skills')).isSymbolicLink()).toBe(true);
        expect(vol.existsSync(path.join(OPENCODE_BACKUP_DIR, 'skills', 'existing.md'))).toBe(true);
    });

    it('dest 이미 심볼릭 링크이면 백업 없이 재링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.mkdirSync(OPENCODE_DIR, { recursive: true });
        vol.symlinkSync('/old/skills', path.join(OPENCODE_DIR, 'skills'));
        vol.fromJSON({ [`${repoPath}/skills/new.md`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkOpencode();

        expect(vol.existsSync(OPENCODE_BACKUP_DIR)).toBe(false);
        expect(vol.lstatSync(path.join(OPENCODE_DIR, 'skills')).isSymbolicLink()).toBe(true);
    });

    it('성공 시 configManager.opencode에 path, backup_path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);
        await linkOpencode();
        expect(configManager.opencode).toEqual({ path: OPENCODE_DIR, backup_path: OPENCODE_BACKUP_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

describe('unlinkOpencode', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        configManager.opencode = null;
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('force=true → confirm 없이 심볼릭 링크 제거', async () => {
        vol.mkdirSync(OPENCODE_DIR, { recursive: true });
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(OPENCODE_DIR, 'skills'));

        await unlinkOpencode(true);

        expect(confirm).not.toHaveBeenCalled();
        expect(vol.existsSync(path.join(OPENCODE_DIR, 'skills'))).toBe(false);
    });

    it('백업 존재 → 복원', async () => {
        configManager.opencode = { path: OPENCODE_DIR, backup_path: OPENCODE_BACKUP_DIR };
        vol.mkdirSync(OPENCODE_DIR, { recursive: true });
        vol.mkdirSync(path.join(OPENCODE_BACKUP_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(OPENCODE_BACKUP_DIR, 'skills', 'original.md'), 'backup');
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(OPENCODE_DIR, 'skills'));

        await unlinkOpencode(true);

        expect(vol.existsSync(path.join(OPENCODE_DIR, 'skills', 'original.md'))).toBe(true);
    });

    it('성공 시 configManager.opencode = null, save 호출', async () => {
        await unlinkOpencode(true);
        expect(configManager.opencode).toBeNull();
        expect(configManager.save).toHaveBeenCalled();
    });
});
