import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CLAUDE_CODE_DIR, ROO_DIR } from '@/_defs';

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        remote_url: null,
        claude_code: null,
        roocode: null,
        openclaw: null,
        codex: null,
        antigravity: null,
        isClaudeCodeEnabled: vi.fn().mockReturnValue(false),
        isRooCodeEnabled: vi.fn().mockReturnValue(false),
        isOpenclawEnabled: vi.fn().mockReturnValue(false),
        isCodexEnabled: vi.fn().mockReturnValue(false),
        isAntigravityEnabled: vi.fn().mockReturnValue(false),
    }
}));

const { statusCommand } = await import('@/commands/status-command');
const { configManager } = await import('@/_libs/config');

describe('statusCommand', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        configManager.repo_path = null;
        configManager.remote_url = null;
        configManager.claude_code = null;
        configManager.roocode = null;
        configManager.openclaw = null;
        configManager.codex = null;
        configManager.antigravity = null;
        vi.mocked(configManager.isClaudeCodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(false);
        vi.mocked(configManager.isOpenclawEnabled).mockReturnValue(false);
        vi.mocked(configManager.isCodexEnabled).mockReturnValue(false);
        vi.mocked(configManager.isAntigravityEnabled).mockReturnValue(false);
    });

    it('repo_path 없음 → "No repo installed." 출력', () => {
        configManager.repo_path = null;

        statusCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).toContain('No repo installed');
    });

    it('repo_path 없음 → install 안내 출력', () => {
        configManager.repo_path = null;

        statusCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).toContain('set-prompt install');
    });

    it('repo_path 있음 → path 출력', () => {
        configManager.repo_path = '/fake/repo';

        statusCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).toContain('/fake/repo');
    });

    it('remote_url 있음 → remote 출력', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = 'https://github.com/foo/bar.git';

        statusCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).toContain('https://github.com/foo/bar.git');
    });

    it('remote_url 없음 → remote 미출력', () => {
        configManager.repo_path = '/fake/repo';
        configManager.remote_url = null;

        statusCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).not.toContain('remote');
    });

    it('claude_code 링크됨 → linked + path 출력', () => {
        configManager.repo_path = '/fake/repo';
        configManager.claude_code = { path: CLAUDE_CODE_DIR };
        vi.mocked(configManager.isClaudeCodeEnabled).mockReturnValue(true);

        statusCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).toContain('linked');
        expect(output).toContain(CLAUDE_CODE_DIR);
    });

    it('roocode 링크됨 → linked + path 출력', () => {
        configManager.repo_path = '/fake/repo';
        configManager.roocode = { path: ROO_DIR, backup_path: null };
        vi.mocked(configManager.isRooCodeEnabled).mockReturnValue(true);

        statusCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).toContain('linked');
        expect(output).toContain(ROO_DIR);
    });

    it('미링크 에이전트 → "not linked" 출력', () => {
        configManager.repo_path = '/fake/repo';

        statusCommand();

        const output = consoleSpy.mock.calls.flat().join('\n');
        expect(output).toContain('not linked');
    });
});
