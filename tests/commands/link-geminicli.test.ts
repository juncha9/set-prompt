import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { GEMINICLI_DIR, GEMINICLI_BACKUP_DIR } from '@/_defs';

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
        geminicli: null,
        save: vi.fn(),
    }
}));

const { linkGeminicli, unlinkGeminicli } = await import('@/link/geminicli');
const { configManager } = await import('@/_libs/config');
const { confirm } = await import('@inquirer/prompts');
const { pathExists } = await import('fs-extra');

describe('linkGeminicli', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → GEMINICLI_DIR 미생성', async () => {
        configManager.repo_path = null;
        await linkGeminicli();
        expect(vol.existsSync(GEMINICLI_DIR)).toBe(false);
    });

    it('repo_path 설정 → GEMINICLI_DIR 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);
        await linkGeminicli();
        expect(vol.existsSync(GEMINICLI_DIR)).toBe(true);
    });

    it('skills/commands/agents 디렉토리 존재 시 모두 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.fromJSON({
            [`${repoPath}/skills/my-skill/SKILL.md`]: '---\nname: my-skill\n---',
            [`${repoPath}/commands/test.toml`]: 'prompt = "x"',
            [`${repoPath}/agents/test.md`]: '---\nname: x\n---',
        });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkGeminicli();

        expect(vol.lstatSync(path.join(GEMINICLI_DIR, 'skills')).isSymbolicLink()).toBe(true);
        expect(vol.lstatSync(path.join(GEMINICLI_DIR, 'commands')).isSymbolicLink()).toBe(true);
        expect(vol.lstatSync(path.join(GEMINICLI_DIR, 'agents')).isSymbolicLink()).toBe(true);
    });

    it('hooks 디렉토리는 링크하지 않음 (Gemini CLI 는 skills/commands/agents 만 지원)', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.fromJSON({
            [`${repoPath}/skills/my-skill/SKILL.md`]: 'test',
            [`${repoPath}/hooks/test.sh`]: 'test',
        });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkGeminicli();

        expect(vol.existsSync(path.join(GEMINICLI_DIR, 'hooks'))).toBe(false);
    });

    it('기존 commands 디렉토리 백업 후 링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.mkdirSync(path.join(GEMINICLI_DIR, 'commands'), { recursive: true });
        vol.writeFileSync(path.join(GEMINICLI_DIR, 'commands', 'existing.toml'), 'existing');
        vol.fromJSON({ [`${repoPath}/commands/new.toml`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);
        vi.mocked(confirm).mockResolvedValue(true);

        await linkGeminicli();

        expect(vol.lstatSync(path.join(GEMINICLI_DIR, 'commands')).isSymbolicLink()).toBe(true);
        expect(vol.existsSync(path.join(GEMINICLI_BACKUP_DIR, 'commands', 'existing.toml'))).toBe(true);
    });

    it('dest 이미 심볼릭 링크이면 백업 없이 재링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;
        vol.mkdirSync(GEMINICLI_DIR, { recursive: true });
        vol.symlinkSync('/old/commands', path.join(GEMINICLI_DIR, 'commands'));
        vol.fromJSON({ [`${repoPath}/commands/new.toml`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkGeminicli();

        expect(vol.existsSync(GEMINICLI_BACKUP_DIR)).toBe(false);
        expect(vol.lstatSync(path.join(GEMINICLI_DIR, 'commands')).isSymbolicLink()).toBe(true);
    });

    it('성공 시 configManager.geminicli에 path, backup_path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);
        await linkGeminicli();
        expect(configManager.geminicli).toEqual({ path: GEMINICLI_DIR, backup_path: GEMINICLI_BACKUP_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

describe('unlinkGeminicli', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        configManager.geminicli = null;
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('force=true → confirm 없이 심볼릭 링크 제거', async () => {
        vol.mkdirSync(GEMINICLI_DIR, { recursive: true });
        const fakeTarget = '/fake/repo/commands';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(GEMINICLI_DIR, 'commands'));

        await unlinkGeminicli(true);

        expect(confirm).not.toHaveBeenCalled();
        expect(vol.existsSync(path.join(GEMINICLI_DIR, 'commands'))).toBe(false);
    });

    it('백업 존재 → 복원', async () => {
        configManager.geminicli = { path: GEMINICLI_DIR, backup_path: GEMINICLI_BACKUP_DIR };
        vol.mkdirSync(GEMINICLI_DIR, { recursive: true });
        vol.mkdirSync(path.join(GEMINICLI_BACKUP_DIR, 'commands'), { recursive: true });
        vol.writeFileSync(path.join(GEMINICLI_BACKUP_DIR, 'commands', 'original.toml'), 'backup');
        const fakeTarget = '/fake/repo/commands';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(GEMINICLI_DIR, 'commands'));

        await unlinkGeminicli(true);

        expect(vol.existsSync(path.join(GEMINICLI_DIR, 'commands', 'original.toml'))).toBe(true);
    });

    it('성공 시 configManager.geminicli = null, save 호출', async () => {
        await unlinkGeminicli(true);
        expect(configManager.geminicli).toBeNull();
        expect(configManager.save).toHaveBeenCalled();
    });
});
