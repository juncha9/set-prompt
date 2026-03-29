import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('@inquirer/prompts', () => ({ confirm: vi.fn() }));
vi.mock('child_process', () => ({ spawnSync: vi.fn() }));
vi.mock('@/commands/scaffold-command', () => ({ scaffoldCommand: vi.fn() }));
vi.mock('@/_libs/config', () => ({
    configManager: {
        repo_path: null,
        remote_url: null,
        save: vi.fn().mockReturnValue(true),
    }
}));

const { installCommand } = await import('@/commands/install-command');
const { confirm } = await import('@inquirer/prompts');
const { spawnSync } = await import('child_process');
const { configManager } = await import('@/_libs/config');

const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
}) as any);

describe('installCommand', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-prompt-test-'));
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
        exitSpy.mockClear();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('로컬 경로 → process.exit(1)', async () => {
        await expect(installCommand(tmpDir)).rejects.toThrow('process.exit called');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('유효하지 않은 문자열 → process.exit(1)', async () => {
        await expect(installCommand('not-a-url')).rejects.toThrow('process.exit called');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('git URL → confirm 프롬프트 표시', async () => {
        vi.mocked(confirm).mockResolvedValue(false);

        await installCommand('https://github.com/foo/bar.git');

        expect(confirm).toHaveBeenCalled();
    });

    it('사용자가 거부 → clone 미실행', async () => {
        vi.mocked(confirm).mockResolvedValue(false);

        await installCommand('https://github.com/foo/bar.git');

        expect(spawnSync).not.toHaveBeenCalled();
    });

    it('사용자가 확인 → git clone 실행', async () => {
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        await installCommand('https://github.com/foo/bar.git');

        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            ['clone', 'https://github.com/foo/bar.git', expect.any(String)],
            { stdio: 'inherit' }
        );
    });

    it('clone 성공 → configManager에 repo_path, remote_url 저장', async () => {
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        await installCommand('https://github.com/foo/bar.git');

        expect(configManager.repo_path).toBeDefined();
        expect(configManager.remote_url).toBe('https://github.com/foo/bar.git');
        expect(configManager.save).toHaveBeenCalled();
    });

    it('clone 실패 → process.exit(1)', async () => {
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);

        await expect(installCommand('https://github.com/foo/bar.git')).rejects.toThrow('process.exit called');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('ssh git URL 인식 → clone 호출', async () => {
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        await installCommand('git@github.com:foo/bar.git');

        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['clone']),
            expect.anything()
        );
    });
});
