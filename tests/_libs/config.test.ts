import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { CONFIG_PATH, HOME_DIR } from '@/_defs';

vi.mock('fs', async () => {
    const { fs } = await import('memfs');
    return { default: fs, ...fs };
});

const { configManager } = await import('@/_libs/config');

const VALID_CONFIG = {
    repo_path: '/some/repo',
    remote_url: null,
    claude_code: null,
    roocode: null,
    openclaw: null,
};

describe('configManager', () => {
    beforeEach(() => {
        vol.reset();
        configManager.repo_path   = null;
        configManager.remote_url  = null;
        configManager.claude_code = null;
        configManager.roocode     = null;
        configManager.openclaw    = null;
    });

    describe('reload', () => {
        it('config 파일 없으면 프로퍼티 null 유지', () => {
            configManager.reload();
            expect(configManager.repo_path).toBeNull();
        });

        it('유효한 JSON → 프로퍼티 로드', () => {
            vol.fromJSON({ [CONFIG_PATH]: JSON.stringify(VALID_CONFIG) });
            configManager.reload();
            expect(configManager.repo_path).toBe('/some/repo');
            expect(configManager.remote_url).toBeNull();
        });

        it('remote_url 포함 JSON → 함께 로드', () => {
            const config = { ...VALID_CONFIG, remote_url: 'https://github.com/foo/bar' };
            vol.fromJSON({ [CONFIG_PATH]: JSON.stringify(config) });
            configManager.reload();
            expect(configManager.remote_url).toBe('https://github.com/foo/bar');
        });

        it('잘못된 JSON → 프로퍼티 null 유지', () => {
            vol.fromJSON({ [CONFIG_PATH]: 'this is not json' });
            configManager.reload();
            expect(configManager.repo_path).toBeNull();
        });

        it('스키마 불일치 JSON → 프로퍼티 null 유지', () => {
            vol.fromJSON({ [CONFIG_PATH]: JSON.stringify({ invalid_key: 'value' }) });
            configManager.reload();
            expect(configManager.repo_path).toBeNull();
        });
    });

    describe('save', () => {
        it('repo_path 미설정 시 false 반환', () => {
            expect(configManager.save()).toBe(false);
        });

        it('저장 후 true 반환 및 JSON 파일 생성', () => {
            configManager.repo_path = '/my/repo';
            const result = configManager.save();
            expect(result).toBe(true);

            const content = vol.readFileSync(CONFIG_PATH, 'utf-8') as string;
            const parsed = JSON.parse(content);
            expect(parsed.repo_path).toBe('/my/repo');
        });

        it('HOME_DIR 없어도 자동 생성', () => {
            configManager.repo_path = '/my/repo';
            configManager.save();
            expect(vol.statSync(HOME_DIR).isDirectory()).toBe(true);
        });

        it('저장 후 reload로 동일 값 복원', () => {
            configManager.repo_path   = '/round/trip';
            configManager.remote_url  = 'https://example.com';
            configManager.claude_code = { path: '/some/claude-code/dir' };
            configManager.save();

            configManager.repo_path   = null;
            configManager.remote_url  = null;
            configManager.claude_code = null;
            configManager.reload();

            expect(configManager.repo_path).toBe('/round/trip');
            expect(configManager.remote_url).toBe('https://example.com');
            expect(configManager.claude_code).toEqual({ path: '/some/claude-code/dir' });
        });

        it('claude_code path 저장', () => {
            configManager.repo_path   = '/my/repo';
            configManager.claude_code = { path: '/my/claude-code' };
            configManager.save();

            const content = vol.readFileSync(CONFIG_PATH, 'utf-8') as string;
            expect(JSON.parse(content).claude_code).toEqual({ path: '/my/claude-code' });
        });

        it('roocode path, backup_path 저장', () => {
            configManager.repo_path = '/my/repo';
            configManager.roocode   = { path: '/home/.roo', backup_path: '/home/.roo/.set-prompt-backup' };
            configManager.save();

            const content = vol.readFileSync(CONFIG_PATH, 'utf-8') as string;
            expect(JSON.parse(content).roocode).toEqual({
                path: '/home/.roo',
                backup_path: '/home/.roo/.set-prompt-backup',
            });
        });
    });

    describe('exists / isRepoSet', () => {
        it('config 파일 없으면 exists() false', () => {
            expect(configManager.exists()).toBe(false);
        });

        it('저장 후 exists() true', () => {
            configManager.repo_path = '/my/repo';
            configManager.save();
            expect(configManager.exists()).toBe(true);
        });

        it('repo_path null이면 isRepoSet() false', () => {
            expect(configManager.isRepoSet()).toBe(false);
        });

        it('repo_path 설정 후 isRepoSet() true', () => {
            configManager.repo_path = '/my/repo';
            expect(configManager.isRepoSet()).toBe(true);
        });

        it('claude_code null이면 isClaudeCodeEnabled() false', () => {
            expect(configManager.isClaudeCodeEnabled()).toBe(false);
        });

        it('claude_code 설정 후 isClaudeCodeEnabled() true', () => {
            configManager.claude_code = { path: '/some/path' };
            expect(configManager.isClaudeCodeEnabled()).toBe(true);
        });
    });
});
