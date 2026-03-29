import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';

vi.mock('fs', async () => {
    const { fs } = await import('memfs');
    return { default: fs, ...fs };
});

vi.mock('@inquirer/prompts', () => ({ confirm: vi.fn() }));

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
const { confirm } = await import('@inquirer/prompts');
const { configManager } = await import('@/_libs/config');

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
        vol.mkdirSync(path.join(FAKE_REPO, 'skills'), { recursive: true });
        vol.mkdirSync(path.join(FAKE_REPO, 'commands'), { recursive: true });
        configManager.repo_path = FAKE_REPO;

        const result = await scaffoldCommand();

        expect(result).toBe(true);
    });

    it('유효하지 않은 경로 → process.exit(1)', async () => {
        await expect(scaffoldCommand('/nonexistent/path')).rejects.toThrow('process.exit called');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('필수 디렉터리 모두 존재 → true 반환 (confirm 없음)', async () => {
        vol.mkdirSync(path.join(FAKE_REPO, 'skills'), { recursive: true });
        vol.mkdirSync(path.join(FAKE_REPO, 'commands'), { recursive: true });

        const result = await scaffoldCommand(FAKE_REPO);

        expect(result).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
    });

    it('누락된 디렉터리 존재 → confirm 표시', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(false);

        await scaffoldCommand(FAKE_REPO);

        expect(confirm).toHaveBeenCalled();
    });

    it('누락된 디렉터리 존재 + 사용자 취소 → false 반환', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(false);

        const result = await scaffoldCommand(FAKE_REPO);

        expect(result).toBe(false);
    });

    it('누락된 디렉터리 존재 + 사용자 확인 → 디렉터리 생성 및 true 반환', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });
        vi.mocked(confirm).mockResolvedValue(true);

        const result = await scaffoldCommand(FAKE_REPO);

        expect(result).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, 'skills'))).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, 'commands'))).toBe(true);
    });

    it('--force → confirm 없이 디렉터리 생성', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });

        const result = await scaffoldCommand(FAKE_REPO, { force: true });

        expect(result).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
        expect(vol.existsSync(path.join(FAKE_REPO, 'skills'))).toBe(true);
        expect(vol.existsSync(path.join(FAKE_REPO, 'commands'))).toBe(true);
    });

    it('--force → SET_PROMPT_GUIDE.md 생성', async () => {
        vol.mkdirSync(FAKE_REPO, { recursive: true });

        await scaffoldCommand(FAKE_REPO, { force: true });

        expect(vol.existsSync(path.join(FAKE_REPO, 'SET_PROMPT_GUIDE.md'))).toBe(true);
    });

    it('이미 존재하는 디렉터리는 건너뜀', async () => {
        vol.mkdirSync(path.join(FAKE_REPO, 'skills'), { recursive: true });
        vol.writeFileSync(path.join(FAKE_REPO, 'skills', 'existing.md'), 'test');
        vi.mocked(confirm).mockResolvedValue(true);

        await scaffoldCommand(FAKE_REPO);

        // 기존 파일이 유지되어야 함
        expect(vol.existsSync(path.join(FAKE_REPO, 'skills', 'existing.md'))).toBe(true);
    });
});
