import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import os from 'os';
import { CLAUDE_CODE_DIR } from '@/_defs';

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
        claude_code: null,
        save: vi.fn(),
    }
}));

const { linkClaudeCode, unlinkClaudeCode } = await import('@/link/claudecode');
const { configManager } = await import('@/_libs/config');
const { confirm } = await import('@inquirer/prompts');

// ─── linkClaudeCode ─────────────────────────────────────────────────────────

describe('linkClaudeCode', () => {
    beforeEach(() => {
        vol.reset();
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
        await linkClaudeCode();
        expect(vol.existsSync(CLAUDE_CODE_DIR)).toBe(true);
    });

    it('marketplace.json 생성', async () => {
        configManager.repo_path = '/fake/repo';
        await linkClaudeCode();

        const marketplacePath = path.join(CLAUDE_CODE_DIR, '.claude-plugin', 'marketplace.json');
        expect(vol.existsSync(marketplacePath)).toBe(true);
    });

    it('plugins/sppt → repo symlink 생성', async () => {
        configManager.repo_path = '/fake/repo';
        await linkClaudeCode();

        const pluginLink = path.join(CLAUDE_CODE_DIR, 'plugins', 'sppt');
        expect(vol.lstatSync(pluginLink).isSymbolicLink()).toBe(true);
        expect(vol.readlinkSync(pluginLink)).toBe('/fake/repo');
    });

    it('성공 시 configManager.claude_code에 path 저장', async () => {
        configManager.repo_path = '/fake/repo';
        await linkClaudeCode();
        expect(configManager.claude_code).toEqual({ path: CLAUDE_CODE_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });

    it('installed_plugins.json에 sppt@set-prompt installPath 등록', async () => {
        configManager.repo_path = '/fake/repo';
        await linkClaudeCode();

        const installedPluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
        const data = JSON.parse(vol.readFileSync(installedPluginsPath, 'utf-8') as string);
        const entry = data.plugins['sppt@set-prompt']?.[0];

        expect(entry).toBeDefined();
        expect(entry.installPath).toBe('/fake/repo');
        expect(entry.scope).toBe('user');
    });

    it('installed_plugins.json 기존 항목 유지, sppt@set-prompt만 추가', async () => {
        configManager.repo_path = '/fake/repo';

        const installedPluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
        vol.mkdirSync(path.dirname(installedPluginsPath), { recursive: true });
        vol.writeFileSync(installedPluginsPath, JSON.stringify({
            version: 2,
            plugins: {
                'atlassian@claude-plugins-official': [{ scope: 'user', installPath: '/some/path', version: 'abc123' }],
            },
        }), 'utf-8');

        await linkClaudeCode();

        const data = JSON.parse(vol.readFileSync(installedPluginsPath, 'utf-8') as string);
        expect(data.plugins['atlassian@claude-plugins-official']).toBeDefined();
        expect(data.plugins['sppt@set-prompt']?.[0].installPath).toBe('/fake/repo');
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

    it('force=true → CLAUDE_CODE_DIR 제거', async () => {
        vol.mkdirSync(CLAUDE_CODE_DIR, { recursive: true });
        await unlinkClaudeCode(true);
        expect(confirm).not.toHaveBeenCalled();
        expect(vol.existsSync(CLAUDE_CODE_DIR)).toBe(false);
    });

    it('settings.json에서 set-prompt 항목만 제거, 나머지 보존', async () => {
        vol.mkdirSync(path.dirname(claudeSettingsPath), { recursive: true });
        vol.writeFileSync(claudeSettingsPath, JSON.stringify({
            extraKnownMarketplaces: { 'set-prompt': {}, other: {} },
            enabledPlugins: { 'sppt@set-prompt': true, other: true },
        }));
        vi.mocked(confirm).mockResolvedValue(true);
        await unlinkClaudeCode(false);

        const s = JSON.parse(vol.readFileSync(claudeSettingsPath, 'utf-8') as string);
        expect(s.extraKnownMarketplaces?.['set-prompt']).toBeUndefined();
        expect(s.enabledPlugins?.['sppt@set-prompt']).toBeUndefined();
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

    it('installed_plugins.json에서 @set-prompt 항목만 제거', async () => {
        const installedPluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
        vol.mkdirSync(path.dirname(installedPluginsPath), { recursive: true });
        vol.writeFileSync(installedPluginsPath, JSON.stringify({
            version: 2,
            plugins: {
                'sppt@set-prompt': [{ scope: 'project' }],
                'akms@alkemic-studio-plugins': [{ scope: 'project' }],
            },
        }));
        vi.mocked(confirm).mockResolvedValue(true);
        await unlinkClaudeCode(false);

        const result = JSON.parse(vol.readFileSync(installedPluginsPath, 'utf-8') as string);
        expect(result.plugins['sppt@set-prompt']).toBeUndefined();
        expect(result.plugins['akms@alkemic-studio-plugins']).toBeDefined();
    });

    it('known_marketplaces.json에서 set-prompt 항목만 제거', async () => {
        const knownMarketplacesPath = path.join(os.homedir(), '.claude', 'plugins', 'known_marketplaces.json');
        vol.mkdirSync(path.dirname(knownMarketplacesPath), { recursive: true });
        vol.writeFileSync(knownMarketplacesPath, JSON.stringify({
            'set-prompt': { source: { source: 'directory' } },
            'alkemic-studio-plugins': { source: { source: 'git' } },
        }));
        vi.mocked(confirm).mockResolvedValue(true);
        await unlinkClaudeCode(false);

        const result = JSON.parse(vol.readFileSync(knownMarketplacesPath, 'utf-8') as string);
        expect(result['set-prompt']).toBeUndefined();
        expect(result['alkemic-studio-plugins']).toBeDefined();
    });
});
