import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import os from 'os';
import { CLAUDE_CODE_DIR, ROO_DIR, ROO_BACKUP_DIR, OPENCLAW_DIR, OPENCLAW_BACKUP_DIR, ANTIGRAVITY_DIR, ANTIGRAVITY_BACKUP_DIR } from '@/_defs';

vi.mock('fs', async () => {
    const { fs } = await import('memfs');
    return { default: fs, ...fs };
});

vi.mock('fs-extra', () => ({
    pathExists: vi.fn(),
}));

vi.mock('@inquirer/prompts', () => ({
    confirm: vi.fn(),
    checkbox: vi.fn(),
}));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        remote_url: null,
        claude_code: null,
        roocode: null,
        openclaw: null,
        codex: null,
        antigravity: null,
        save: vi.fn(),
        isClaudeCodeEnabled: vi.fn().mockReturnValue(false),
        isRooCodeEnabled: vi.fn().mockReturnValue(false),
        isOpenclawEnabled: vi.fn().mockReturnValue(false),
        isCodexEnabled: vi.fn().mockReturnValue(false),
        isAntigravityEnabled: vi.fn().mockReturnValue(false),
    }
}));

const {
    linkClaudeCode, linkRooCode, linkOpenclaw, linkAntigravity,
    unlinkClaudeCode, unlinkRooCode, unlinkOpenclaw, unlinkAntigravity,
    linkCommand,
} = await import('@/commands/link-command');
const { configManager } = await import('@/_libs/config');
const { confirm, checkbox } = await import('@inquirer/prompts');
const { pathExists } = await import('fs-extra');

describe('linkClaudeCode', () => {
    beforeEach(() => {
        vol.reset();
        // memfs에 ~/.claude 경로 생성
        vol.mkdirSync(path.join(os.homedir(), '.claude'), { recursive: true });
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → CLAUDE_CODE_DIR 미생성', async () => {
        configManager.repo_path = null;

        await linkClaudeCode();

        expect(vol.existsSync(CLAUDE_CODE_DIR)).toBe(false);
    });

    it('repo_path 설정 → CLAUDE_CODE_DIR 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkClaudeCode();

        expect(vol.existsSync(CLAUDE_CODE_DIR)).toBe(true);
    });

    it('marketplace.json, plugin.json 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkClaudeCode();

        const marketplacePath = path.join(CLAUDE_CODE_DIR, '.claude-plugin', 'marketplace.json');
        const pluginPath = path.join(CLAUDE_CODE_DIR, 'plugins', 'set-prompt', '.claude-plugin', 'plugin.json');

        expect(vol.existsSync(marketplacePath)).toBe(true);
        expect(vol.existsSync(pluginPath)).toBe(true);
    });

    it('skills 디렉토리 존재 시 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({ [`${repoPath}/skills/test.md`]: 'test' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkClaudeCode();

        const dest = path.join(CLAUDE_CODE_DIR, 'plugins', 'set-prompt', 'skills');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('dest 이미 존재하면 삭제 후 재링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({ [`${repoPath}/skills/test.md`]: 'test' });
        const dest = path.join(CLAUDE_CODE_DIR, 'plugins', 'set-prompt', 'skills');
        vol.mkdirSync(dest, { recursive: true });

        vi.mocked(pathExists).mockResolvedValue(true);

        await linkClaudeCode();

        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('agents 디렉토리 존재 시 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({ [`${repoPath}/agents/test.md`]: 'test' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkClaudeCode();

        const dest = path.join(CLAUDE_CODE_DIR, 'plugins', 'set-prompt', 'agents');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('성공 시 configManager.claude_code에 path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkClaudeCode();

        expect(configManager.claude_code).toEqual({ path: CLAUDE_CODE_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

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

describe('linkOpenclaw', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('repo_path 미설정 → OPENCLAW_DIR 미생성', async () => {
        configManager.repo_path = null;

        await linkOpenclaw();

        expect(vol.existsSync(OPENCLAW_DIR)).toBe(false);
    });

    it('repo_path 설정 → OPENCLAW_DIR 생성', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkOpenclaw();

        expect(vol.existsSync(OPENCLAW_DIR)).toBe(true);
    });

    it('skills 디렉토리 존재 시 심볼릭 링크 생성', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({ [`${repoPath}/skills/test.md`]: 'test' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkOpenclaw();

        const dest = path.join(OPENCLAW_DIR, 'skills');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('commands 디렉토리는 링크하지 않음', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.fromJSON({
            [`${repoPath}/skills/test.md`]: 'test',
            [`${repoPath}/commands/test.md`]: 'test',
        });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkOpenclaw();

        expect(vol.existsSync(path.join(OPENCLAW_DIR, 'commands'))).toBe(false);
    });

    it('기존 skills 디렉토리 백업 후 링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        vol.mkdirSync(path.join(OPENCLAW_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(OPENCLAW_DIR, 'skills', 'existing.md'), 'existing');
        vol.fromJSON({ [`${repoPath}/skills/new.md`]: 'new' });
        vi.mocked(pathExists).mockResolvedValue(true);

        await linkOpenclaw();

        const dest = path.join(OPENCLAW_DIR, 'skills');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
    });

    it('성공 시 configManager.openclaw에 path, backup_path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkOpenclaw();

        expect(configManager.openclaw).toMatchObject({ path: OPENCLAW_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

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

        const dest = path.join(ANTIGRAVITY_DIR, 'skills');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
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

        await linkAntigravity();

        const dest = path.join(ANTIGRAVITY_DIR, 'skills');
        expect(vol.lstatSync(dest).isSymbolicLink()).toBe(true);
        expect(vol.existsSync(path.join(ANTIGRAVITY_BACKUP_DIR, 'skills', 'existing.md'))).toBe(true);
    });

    it('dest 이미 심볼릭 링크이면 백업 없이 재링크', async () => {
        const repoPath = '/fake/repo';
        configManager.repo_path = repoPath;

        // ANTIGRAVITY_DIR만 먼저 생성하고, skills는 symlink로만 설정
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

// ─── unlinkClaudeCode ─────────────────────────────────────────────────────────

describe('unlinkClaudeCode', () => {
    const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');

    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('force=false, 사용자 취소 → 아무것도 제거하지 않음', async () => {
        vol.mkdirSync(CLAUDE_CODE_DIR, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(false);

        await unlinkClaudeCode(false);

        expect(vol.existsSync(CLAUDE_CODE_DIR)).toBe(true);
        expect(configManager.save).not.toHaveBeenCalled();
    });

    it('force=true → confirm 없이 CLAUDE_CODE_DIR 제거', async () => {
        vol.mkdirSync(CLAUDE_CODE_DIR, { recursive: true });

        await unlinkClaudeCode(true);

        expect(confirm).not.toHaveBeenCalled();
        expect(vol.existsSync(CLAUDE_CODE_DIR)).toBe(false);
    });

    it('settings.json에서 set-prompt 항목만 제거, 나머지 보존', async () => {
        vol.mkdirSync(path.dirname(claudeSettingsPath), { recursive: true });
        vol.writeFileSync(claudeSettingsPath, JSON.stringify({
            extraKnownMarketplaces: { 'set-prompt': {}, other: {} },
            enabledPlugins: { 'set-prompt@set-prompt': true, other: true },
        }));
        vi.mocked(confirm).mockResolvedValue(true);

        await unlinkClaudeCode(false);

        const s = JSON.parse(vol.readFileSync(claudeSettingsPath, 'utf-8') as string);
        expect(s.extraKnownMarketplaces?.['set-prompt']).toBeUndefined();
        expect(s.enabledPlugins?.['set-prompt@set-prompt']).toBeUndefined();
        expect(s.extraKnownMarketplaces?.other).toBeDefined();
        expect(s.enabledPlugins?.other).toBe(true);
    });

    it('settings.json 없어도 오류 없음', async () => {
        vi.mocked(confirm).mockResolvedValue(true);
        await expect(unlinkClaudeCode(false)).resolves.not.toThrow();
    });

    it('성공 시 configManager.claude_code = null, save 호출', async () => {
        vi.mocked(confirm).mockResolvedValue(true);

        await unlinkClaudeCode(false);

        expect(configManager.claude_code).toBeNull();
        expect(configManager.save).toHaveBeenCalled();
    });
});

// ─── unlinkRooCode ────────────────────────────────────────────────────────────

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

// ─── unlinkOpenclaw ───────────────────────────────────────────────────────────

describe('unlinkOpenclaw', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        configManager.openclaw = null;
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('force=true → confirm 없이 심볼릭 링크 제거', async () => {
        vol.mkdirSync(OPENCLAW_DIR, { recursive: true });
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(OPENCLAW_DIR, 'skills'));

        await unlinkOpenclaw(true);

        expect(confirm).not.toHaveBeenCalled();
        expect(vol.existsSync(path.join(OPENCLAW_DIR, 'skills'))).toBe(false);
    });

    it('백업 존재 → 복원', async () => {
        configManager.openclaw = { path: OPENCLAW_DIR, backup_path: OPENCLAW_BACKUP_DIR };
        vol.mkdirSync(OPENCLAW_DIR, { recursive: true });
        vol.mkdirSync(path.join(OPENCLAW_BACKUP_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(OPENCLAW_BACKUP_DIR, 'skills', 'original.md'), 'backup');
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(OPENCLAW_DIR, 'skills'));

        await unlinkOpenclaw(true);

        expect(vol.existsSync(path.join(OPENCLAW_DIR, 'skills', 'original.md'))).toBe(true);
    });

    it('성공 시 configManager.openclaw = null, save 호출', async () => {
        await unlinkOpenclaw(true);

        expect(configManager.openclaw).toBeNull();
        expect(configManager.save).toHaveBeenCalled();
    });
});

// ─── unlinkAntigravity ────────────────────────────────────────────────────────

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

// ─── linkCommand (interactive deselection) ────────────────────────────────────

describe('linkCommand (interactive)', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        configManager.repo_path = '/fake/repo';
        vi.mocked(configManager.isClaudeCodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isOpenclawEnabled).mockReturnValue(false);
        vi.mocked(configManager.isCodexEnabled).mockReturnValue(false);
        vi.mocked(configManager.isAntigravityEnabled).mockReturnValue(false);
        vi.mocked(configManager.save).mockReturnValue(true);
        vi.mocked(pathExists).mockResolvedValue(false);
    });

    it('미연결 → 선택 → linkRooCode 호출', async () => {
        vi.mocked(checkbox).mockResolvedValue(['roocode']);

        await linkCommand();

        expect(configManager.roocode).toMatchObject({ path: ROO_DIR });
    });

    it('연결됨 → 선택 해제 → unlinkRooCode(true) 호출 (백업 없음)', async () => {
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(true);
        configManager.roocode = { path: ROO_DIR, backup_path: null };
        vol.mkdirSync(ROO_DIR, { recursive: true });
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(ROO_DIR, 'skills'));

        // 체크박스에서 roocode 선택 해제 (빈 배열 반환)
        vi.mocked(checkbox).mockResolvedValue([]);

        await linkCommand();

        expect(vol.existsSync(path.join(ROO_DIR, 'skills'))).toBe(false);
        expect(configManager.roocode).toBeNull();
    });

    it('연결됨 → 그대로 선택 유지 → 변경 없음', async () => {
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(true);
        configManager.roocode = { path: ROO_DIR, backup_path: null };
        vi.mocked(checkbox).mockResolvedValue(['roocode']);

        const saveCalls = vi.mocked(configManager.save).mock.calls.length;

        await linkCommand();

        // link도 unlink도 호출 안 되므로 save 추가 호출 없음
        expect(vi.mocked(configManager.save).mock.calls.length).toBe(saveCalls);
    });
});
