import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { CONFIG_PATH, HOME_DIR } from '@/_defs';

vi.mock('fs', async () => {
    const { fs } = await import('memfs');
    return { default: fs, ...fs };
});

// typia.assert는 빌드 타임 변환 — 테스트에서는 pass-through로 대체
vi.mock('typia', () => ({
    default: { assert: (x: unknown) => x },
}));

// vi.mock 호이스팅 이후에 import
const { getConfig, setConfig, configManager } = await import('@/_libs/config');

describe('config', () => {
    beforeEach(() => {
        vol.reset();
        configManager.reload(); // memfs에서 config 다시 로드
    });

    describe('getConfig', () => {
        it('config 파일 없으면 null 반환', () => {
            expect(getConfig()).toBeNull();
        });

        it('유효한 TOML → config 반환', () => {
            vol.fromJSON({
                [CONFIG_PATH]: `repo_path = "/some/repo"\nremote_url = "https://github.com/foo/bar"`,
            });
            const config = getConfig();
            expect(config).toEqual({
                repo_path: '/some/repo',
                remote_url: 'https://github.com/foo/bar',
            });
        });

        it('remote_url 없는 config → repo_path만 반환', () => {
            vol.fromJSON({
                [CONFIG_PATH]: `repo_path = "/local/repo"`,
            });
            const config = getConfig();
            expect(config?.repo_path).toBe('/local/repo');
            expect(config?.remote_url).toBeUndefined();
        });

        it('잘못된 TOML → null 반환', () => {
            vol.fromJSON({
                [CONFIG_PATH]: `this is === not toml`,
            });
            expect(getConfig()).toBeNull();
        });
    });

    describe('setConfig', () => {
        it('config를 TOML로 저장하고 true 반환', () => {
            const result = setConfig({ repo_path: '/my/repo' });
            expect(result).toBe(true);

            const content = vol.readFileSync(CONFIG_PATH, 'utf-8') as string;
            expect(content).toContain('repo_path');
            expect(content).toContain('/my/repo');
        });

        it('remote_url 포함 시 함께 저장', () => {
            setConfig({ repo_path: '/my/repo', remote_url: 'https://github.com/foo/bar' });

            const content = vol.readFileSync(CONFIG_PATH, 'utf-8') as string;
            expect(content).toContain('remote_url');
            expect(content).toContain('https://github.com/foo/bar');
        });

        it('HOME_DIR 없어도 자동 생성', () => {
            setConfig({ repo_path: '/my/repo' });
            const stat = vol.statSync(HOME_DIR);
            expect(stat.isDirectory()).toBe(true);
        });

        it('저장 후 getConfig로 다시 읽을 수 있음', () => {
            const original = { repo_path: '/round/trip', remote_url: 'https://example.com' };
            setConfig(original);
            const loaded = getConfig();
            expect(loaded).toEqual(original);
        });
    });
});
