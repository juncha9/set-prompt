import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { HOME_DIR, CONFIG_PATH } from '@/_defs';

vi.mock('fs', async () => {
    const { fs } = await import('memfs');
    return { default: fs, ...fs };
});

vi.mock('@inquirer/prompts', () => ({ confirm: vi.fn() }));

vi.mock('@/commands/link-command', () => ({
    unlinkClaudeCode:  vi.fn(),
    unlinkRooCode:     vi.fn(),
    unlinkOpenclaw:    vi.fn(),
    unlinkAntigravity: vi.fn(),
    unlinkCodex:       vi.fn(),
    unlinkCursor:      vi.fn(),
    unlinkOpencode:    vi.fn(),
    unlinkGeminicli:   vi.fn(),
    unlinkHermes:      vi.fn(),
}));

vi.mock('@/_libs/config', () => ({
    configManager: {
        save: vi.fn(),
        isClaudeCodeEnabled:  vi.fn().mockReturnValue(false),
        isRooCodeEnabled:     vi.fn().mockReturnValue(false),
        isOpenclawEnabled:    vi.fn().mockReturnValue(false),
        isAntigravityEnabled: vi.fn().mockReturnValue(false),
        isCodexEnabled:       vi.fn().mockReturnValue(false),
        isCursorEnabled:      vi.fn().mockReturnValue(false),
        isOpencodeEnabled:    vi.fn().mockReturnValue(false),
        isGeminicliEnabled:   vi.fn().mockReturnValue(false),
        isHermesEnabled:      vi.fn().mockReturnValue(false),
    },
}));

const { uninstallCommand } = await import('@/commands/uninstall-command');
const { confirm } = await import('@inquirer/prompts');
const { configManager } = await import('@/_libs/config');

describe('uninstallCommand', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.isClaudeCodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isOpenclawEnabled).mockReturnValue(false);
        vi.mocked(configManager.isAntigravityEnabled).mockReturnValue(false);
        vi.mocked(configManager.isCodexEnabled).mockReturnValue(false);
        vi.mocked(configManager.isCursorEnabled).mockReturnValue(false);
        vi.mocked(configManager.isOpencodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isGeminicliEnabled).mockReturnValue(false);
        vi.mocked(configManager.isHermesEnabled).mockReturnValue(false);
    });

    it('제거할 항목 없음 → "Nothing to remove." 출력', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await uninstallCommand();

        expect(spy.mock.calls.flat().join('\n')).toContain('Nothing to remove');
        spy.mockRestore();
    });

    it('사용자 취소 → HOME_DIR 유지, unlink 미호출', async () => {
        vol.mkdirSync(HOME_DIR, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(false);

        await uninstallCommand();

        expect(vol.existsSync(HOME_DIR)).toBe(true);
    });

    it('사용자 확인 → HOME_DIR 제거', async () => {
        vol.mkdirSync(HOME_DIR, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(true);

        await uninstallCommand();

        expect(vol.existsSync(HOME_DIR)).toBe(false);
    });

    it('사용자 확인 → CONFIG_PATH 제거', async () => {
        vol.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
        vol.writeFileSync(CONFIG_PATH, '{}');
        vi.mocked(confirm).mockResolvedValue(true);

        await uninstallCommand();

        expect(vol.existsSync(CONFIG_PATH)).toBe(false);
    });

    it('성공 시 "Uninstalled." 출력', async () => {
        vol.mkdirSync(HOME_DIR, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(true);
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await uninstallCommand();

        expect(spy.mock.calls.flat().join('\n')).toContain('Uninstalled');
        spy.mockRestore();
    });
});
