import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import os from 'os';
import { CODEX_DIR, PLUGIN_NAME } from '@/_defs';

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

vi.mock('smol-toml', () => ({
    default: {
        parse: vi.fn(() => ({})),
        stringify: vi.fn((obj: any) => JSON.stringify(obj)),
    },
}));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        codex: null,
        save: vi.fn(),
    }
}));

const { linkCodex, unlinkCodex } = await import('@/link/codex');
const { configManager } = await import('@/_libs/config');
const { confirm } = await import('@inquirer/prompts');
const { pathExists } = await import('fs-extra');

const CODEX_AGENTS_DIR = path.join(os.homedir(), '.agents', 'plugins');
const CODEX_CACHE_DIR = path.join(os.homedir(), '.codex', 'plugins', 'cache');

describe('linkCodex', () => {
    const FAKE_REPO = '/fake/repo';

    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
        // scaffold로 생성되는 .codex-plugin/plugin.json 시뮬레이션
        vol.mkdirSync(path.join(FAKE_REPO, '.codex-plugin'), { recursive: true });
        vol.writeFileSync(path.join(FAKE_REPO, '.codex-plugin', 'plugin.json'), JSON.stringify({
            name: PLUGIN_NAME, version: '1.0.0', description: 'Managed by set-prompt', skills: './skills/',
        }));
    });

    it('repo_path 미설정 → marketplace 미생성', async () => {
        configManager.repo_path = null;
        await linkCodex();
        expect(vol.existsSync(path.join(CODEX_AGENTS_DIR, 'marketplace.json'))).toBe(false);
    });

    it('marketplace.json 신규 생성 (name: local-repo)', async () => {
        configManager.repo_path = FAKE_REPO;
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkCodex();

        const marketplacePath = path.join(CODEX_AGENTS_DIR, 'marketplace.json');
        expect(vol.existsSync(marketplacePath)).toBe(true);

        const mp = JSON.parse(vol.readFileSync(marketplacePath, 'utf-8') as string);
        expect(mp.name).toBe('local-repo');
        expect(mp.plugins.some((p: any) => p.name === PLUGIN_NAME)).toBe(true);
    });

    it('marketplace.json 기존 항목 유지, sppt만 추가', async () => {
        configManager.repo_path = FAKE_REPO;
        vi.mocked(pathExists).mockResolvedValue(false);

        const marketplacePath = path.join(CODEX_AGENTS_DIR, 'marketplace.json');
        vol.mkdirSync(path.dirname(marketplacePath), { recursive: true });
        vol.writeFileSync(marketplacePath, JSON.stringify({
            name: 'my-marketplace',
            plugins: [{ name: 'other-plugin', source: { source: 'local', path: './other' } }],
        }));

        await linkCodex();

        const mp = JSON.parse(vol.readFileSync(marketplacePath, 'utf-8') as string);
        expect(mp.name).toBe('my-marketplace');
        expect(mp.plugins).toHaveLength(2);
        expect(mp.plugins.find((p: any) => p.name === 'other-plugin')).toBeDefined();
    });

    it('cache 1.0.0 → repo symlink 생성', async () => {
        configManager.repo_path = FAKE_REPO;
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkCodex();

        const cachePath = path.join(CODEX_CACHE_DIR, 'local-repo', PLUGIN_NAME, '1.0.0');
        expect(vol.lstatSync(cachePath).isSymbolicLink()).toBe(true);
        expect(vol.readlinkSync(cachePath)).toBe(FAKE_REPO);
    });

    it('성공 시 configManager.codex에 path 저장', async () => {
        configManager.repo_path = FAKE_REPO;
        vi.mocked(pathExists).mockResolvedValue(false);

        await linkCodex();

        expect(configManager.codex).toEqual({ path: CODEX_DIR });
        expect(configManager.save).toHaveBeenCalled();
    });
});

describe('unlinkCodex', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        configManager.codex = null;
        vi.mocked(configManager.save).mockReturnValue(true);
    });

    it('force=false, 사용자 취소 → 아무것도 제거하지 않음', async () => {
        vi.mocked(confirm).mockResolvedValue(false);

        const marketplacePath = path.join(CODEX_AGENTS_DIR, 'marketplace.json');
        vol.mkdirSync(path.dirname(marketplacePath), { recursive: true });
        vol.writeFileSync(marketplacePath, JSON.stringify({ name: 'local-repo', plugins: [{ name: PLUGIN_NAME }] }));

        await unlinkCodex(false);

        expect(vol.existsSync(marketplacePath)).toBe(true);
        expect(configManager.save).not.toHaveBeenCalled();
    });

    it('force=true → marketplace + cache 제거', async () => {
        const marketplacePath = path.join(CODEX_AGENTS_DIR, 'marketplace.json');
        vol.mkdirSync(path.dirname(marketplacePath), { recursive: true });
        vol.writeFileSync(marketplacePath, JSON.stringify({
            name: 'local-repo',
            plugins: [
                { name: PLUGIN_NAME, source: { source: 'local' } },
                { name: 'other', source: { source: 'local' } },
            ],
        }));

        const cacheDir = path.join(CODEX_CACHE_DIR, 'local-repo');
        vol.mkdirSync(cacheDir, { recursive: true });

        await unlinkCodex(true);

        expect(vol.existsSync(cacheDir)).toBe(false);

        const mp = JSON.parse(vol.readFileSync(marketplacePath, 'utf-8') as string);
        expect(mp.plugins.find((p: any) => p.name === PLUGIN_NAME)).toBeUndefined();
        expect(mp.plugins.find((p: any) => p.name === 'other')).toBeDefined();
    });

    it('성공 시 configManager.codex = null, save 호출', async () => {
        await unlinkCodex(true);
        expect(configManager.codex).toBeNull();
        expect(configManager.save).toHaveBeenCalled();
    });
});
