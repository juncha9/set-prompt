import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';

vi.mock('fs', async () => {
    const { fs } = await import('memfs');
    return { default: fs, ...fs };
});

vi.mock('@inquirer/prompts', () => ({
    confirm: vi.fn(),
}));

vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        save: vi.fn(),
    }
}));

vi.mock('@/_libs/templates', () => ({
    SET_PROMPT_GUIDE: '# Set Prompt Guide',
}));

const { scaffoldCommand } = await import('@/commands/scaffold-command');
const { configManager } = await import('@/_libs/config');
const { confirm } = await import('@inquirer/prompts');

const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
}) as any);

describe('scaffoldCommand', () => {
    const FAKE_REPO = '/fake/repo';

    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
        exitSpy.mockClear();
        configManager.repo_path = null;
        vi.mocked(confirm).mockResolvedValue(true);
    });

    afterEach(() => {
        vol.reset();
    });

    it('path 미제공 + config 없음 → process.exit(1)', async () => {
        configManager.repo_path = null;
        await expect(scaffoldCommand()).rejects.toThrow('process.exit called');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('path 미제공 + config 있음 → config의 repo_path 사용', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });
        configManager.repo_path = FAKE_REPO;

        const result = await scaffoldCommand();

        expect(result).toBe(true);
    });

    it('유효하지 않은 경로 → process.exit(1)', async () => {
        await expect(scaffoldCommand('/nonexistent/path')).rejects.toThrow('process.exit called');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('프롬프트 디렉토리 생성', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });

        const result = await scaffoldCommand(FAKE_REPO);

        expect(result).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, 'skills'))).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, 'commands'))).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, 'hooks'))).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, 'agents'))).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, 'rules'))).toBe(true);
    });

    it('.gitkeep 생성', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });

        await scaffoldCommand(FAKE_REPO);

        expect(vol.existsSync(path.join(FAKE_REPO, 'skills', '.gitkeep'))).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, 'commands', '.gitkeep'))).toBe(true);
    });

    it('confirm=true → SET_PROMPT_GUIDE.md 생성', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(true);

        await scaffoldCommand(FAKE_REPO);

        expect(vol.existsSync(path.join(FAKE_REPO, 'SET_PROMPT_GUIDE.md'))).toBe(true);
    });

    it('confirm=false → SET_PROMPT_GUIDE.md 미생성', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(false);

        await scaffoldCommand(FAKE_REPO);

        expect(vol.existsSync(path.join(FAKE_REPO, 'SET_PROMPT_GUIDE.md'))).toBe(false);
    });

    it('플러그인 매니페스트 생성', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });

        await scaffoldCommand(FAKE_REPO);

        expect(vol.existsSync(path.join(FAKE_REPO, '.claude-plugin', 'plugin.json'))).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, '.codex-plugin', 'plugin.json'))).toBe(true);

        const claudePlugin = JSON.parse(vol.readFileSync(path.join(FAKE_REPO, '.claude-plugin', 'plugin.json'), 'utf-8') as string);
        expect(claudePlugin.name).toBe('sppt');
    });

    it('이미 존재하는 디렉토리는 보존', async () => {
        vol.mkdirSync(path.join(FAKE_REPO, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(FAKE_REPO, 'skills', 'existing.md'), 'test');

        await scaffoldCommand(FAKE_REPO);

        expect(vol.existsSync(path.join(FAKE_REPO, 'skills', 'existing.md'))).toBe(true);
    });

    it('기존 .gitkeep이 있으면 덮어쓰지 않음', async () => {
        vol.mkdirSync(path.join(FAKE_REPO, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(FAKE_REPO, 'skills', '.gitkeep'), 'existing');

        await scaffoldCommand(FAKE_REPO);

        expect(vol.readFileSync(path.join(FAKE_REPO, 'skills', '.gitkeep'), 'utf-8')).toBe('existing');
    });

    it('반복 실행해도 오류 없음', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });

        await scaffoldCommand(FAKE_REPO);
        const result = await scaffoldCommand(FAKE_REPO);

        expect(result).toBe(true);
    });
});
