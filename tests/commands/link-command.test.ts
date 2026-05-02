import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { ROO_DIR } from '@/_defs';

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

vi.mock('smol-toml', () => ({
    default: {
        parse: vi.fn(() => ({})),
        stringify: vi.fn((obj: any) => JSON.stringify(obj)),
    },
}));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        claude_code: null,
        roocode: null,
        openclaw: null,
        codex: null,
        antigravity: null,
        cursor: null,
        opencode: null,
        geminicli: null,
        hermes: null,
        save: vi.fn(),
        isClaudeCodeEnabled: vi.fn().mockReturnValue(false),
        isRooCodeEnabled: vi.fn().mockReturnValue(false),
        isOpenclawEnabled: vi.fn().mockReturnValue(false),
        isCodexEnabled: vi.fn().mockReturnValue(false),
        isAntigravityEnabled: vi.fn().mockReturnValue(false),
        isCursorEnabled: vi.fn().mockReturnValue(false),
        isOpencodeEnabled: vi.fn().mockReturnValue(false),
        isGeminicliEnabled: vi.fn().mockReturnValue(false),
        isHermesEnabled: vi.fn().mockReturnValue(false),
    }
}));

const { linkCommand } = await import('@/commands/link-command');
const { configManager } = await import('@/_libs/config');
const { checkbox } = await import('@inquirer/prompts');
const { pathExists } = await import('fs-extra');

describe('linkCommand (interactive)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
    }) as any);

    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        exitSpy.mockClear();
        configManager.repo_path = '/fake/repo';
        vi.mocked(configManager.isClaudeCodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isOpenclawEnabled).mockReturnValue(false);
        vi.mocked(configManager.isCodexEnabled).mockReturnValue(false);
        vi.mocked(configManager.isAntigravityEnabled).mockReturnValue(false);
        vi.mocked(configManager.isCursorEnabled).mockReturnValue(false);
        vi.mocked(configManager.isOpencodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isGeminicliEnabled).mockReturnValue(false);
        vi.mocked(configManager.isHermesEnabled).mockReturnValue(false);
        vi.mocked(configManager.save).mockReturnValue(true);
        vi.mocked(pathExists).mockResolvedValue(false);
    });

    it('알 수 없는 tool 인자 → process.exit(1)', async () => {
        await expect(linkCommand('unknown-tool')).rejects.toThrow('process.exit called');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('미연결 → 선택 → linkRooCode 호출', async () => {
        vi.mocked(checkbox).mockResolvedValue(['roocode']);

        await linkCommand();

        expect(configManager.roocode).toMatchObject({ path: ROO_DIR });
    });

    it('연결됨 → 선택 해제 → unlinkRooCode(true) 호출', async () => {
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(true);
        configManager.roocode = { path: ROO_DIR, backup_path: null };
        vol.mkdirSync(ROO_DIR, { recursive: true });
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(ROO_DIR, 'skills'));

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

        expect(vi.mocked(configManager.save).mock.calls.length).toBe(saveCalls);
    });
});
