import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import os from 'os';
import { HOME_DIR, CONFIG_PATH, CLAUDE_CODE_DIR, ROO_DIR, ROO_BACKUP_DIR } from '@/_defs';

vi.mock('fs', async () => {
    const { fs } = await import('memfs');
    return { default: fs, ...fs };
});

vi.mock('@inquirer/prompts', () => ({ confirm: vi.fn() }));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        roocode: null,
        save: vi.fn(),
        isClaudeCodeEnabled: vi.fn().mockReturnValue(false),
        isRooCodeEnabled: vi.fn().mockReturnValue(false),
    }
}));

const { uninstallCommand } = await import('@/commands/uninstall-command');
const { confirm } = await import('@inquirer/prompts');
const { configManager } = await import('@/_libs/config');

describe('uninstallCommand', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        configManager.repo_path = null;
        configManager.roocode = null;
        vi.mocked(configManager.isClaudeCodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(false);
    });

    it('제거할 항목 없음 → "Nothing to remove." 출력', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await uninstallCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).toContain('Nothing to remove');
        consoleSpy.mockRestore();
    });

    it('사용자 취소 → 파일 미제거', async () => {
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

    it('claude_code 링크됨 → settings.json에서 set-prompt 항목 제거', async () => {
        vi.mocked(configManager.isClaudeCodeEnabled).mockReturnValue(true);
        vi.mocked(confirm).mockResolvedValue(true);

        const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        vol.mkdirSync(path.dirname(claudeSettingsPath), { recursive: true });
        vol.writeFileSync(claudeSettingsPath, JSON.stringify({
            extraKnownMarketplaces: {
                'set-prompt': { source: { source: 'directory', path: CLAUDE_CODE_DIR } }
            },
            enabledPlugins: {
                'set-prompt@set-prompt': true
            }
        }));

        await uninstallCommand();

        const raw = vol.readFileSync(claudeSettingsPath, 'utf-8') as string;
        const settings = JSON.parse(raw);
        expect(settings.extraKnownMarketplaces?.['set-prompt']).toBeUndefined();
        expect(settings.enabledPlugins?.['set-prompt@set-prompt']).toBeUndefined();
    });

    it('roocode 링크됨 → ROO_DIR 심볼릭 링크 제거', async () => {
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(true);
        vi.mocked(confirm).mockResolvedValue(true);
        configManager.roocode = { path: ROO_DIR, backup_path: null };

        vol.mkdirSync(ROO_DIR, { recursive: true });
        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(ROO_DIR, 'skills'));

        await uninstallCommand();

        expect(vol.existsSync(path.join(ROO_DIR, 'skills'))).toBe(false);
    });

    it('roocode 백업 존재 → 복원', async () => {
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(true);
        vi.mocked(confirm).mockResolvedValue(true);
        configManager.roocode = { path: ROO_DIR, backup_path: ROO_BACKUP_DIR };

        vol.mkdirSync(ROO_DIR, { recursive: true });
        vol.mkdirSync(path.join(ROO_BACKUP_DIR, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(ROO_BACKUP_DIR, 'skills', 'original.md'), 'backup content');

        const fakeTarget = '/fake/repo/skills';
        vol.mkdirSync(fakeTarget, { recursive: true });
        vol.symlinkSync(fakeTarget, path.join(ROO_DIR, 'skills'));

        await uninstallCommand();

        expect(vol.existsSync(path.join(ROO_DIR, 'skills', 'original.md'))).toBe(true);
    });

    it('성공 시 "Uninstalled." 출력', async () => {
        vol.mkdirSync(HOME_DIR, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(true);
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await uninstallCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).toContain('Uninstalled');
        consoleSpy.mockRestore();
    });
});
