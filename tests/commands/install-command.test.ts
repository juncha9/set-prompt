import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('@inquirer/prompts', () => ({ confirm: vi.fn() }));
vi.mock('child_process', () => ({ spawnSync: vi.fn() }));
vi.mock('@/commands/scaffold-command', () => ({ scaffoldCommand: vi.fn() }));
vi.mock('@/_libs/repo', () => ({ printSaveHint: vi.fn() }));
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
const { printSaveHint } = await import('@/_libs/repo');

const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
}) as any);

describe('installCommand', () => {
    let tmpDir: string;
    let existsSyncSpy: ReturnType<typeof vi.spyOn>;
    let renameSyncSpy: ReturnType<typeof vi.spyOn>;
    let mkdirSyncSpy: ReturnType<typeof vi.spyOn>;
    let rmSyncSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-prompt-test-'));
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
        exitSpy.mockClear();
        configManager.repo_path = null;
        configManager.remote_url = null;

        // 실제 파일시스템 조작 방지
        existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        renameSyncSpy = vi.spyOn(fs, 'renameSync').mockReturnValue(undefined);
        mkdirSyncSpy  = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
        rmSyncSpy     = vi.spyOn(fs, 'rmSync').mockReturnValue(undefined);
    });

    afterEach(() => {
        existsSyncSpy.mockRestore();
        renameSyncSpy.mockRestore();
        mkdirSyncSpy.mockRestore();
        rmSyncSpy.mockRestore();
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

    it('clone 성공 → printSaveHint 호출 (scaffold가 파일을 추가했을 경우 대비)', async () => {
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        await installCommand('https://github.com/foo/bar.git');

        expect(printSaveHint).toHaveBeenCalledWith(expect.any(String));
    });

    it('clone 실패 → process.exit(1)', async () => {
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);

        await expect(installCommand('https://github.com/foo/bar.git')).rejects.toThrow('process.exit called');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('같은 URL로 재install → 차단', async () => {
        configManager.repo_path = '/some/path';
        configManager.remote_url = 'https://github.com/foo/bar.git';

        const result = await installCommand('https://github.com/foo/bar.git');

        expect(result).toBe(false);
        expect(confirm).not.toHaveBeenCalled();
        expect(spawnSync).not.toHaveBeenCalled();
    });

    it('.git 유무 차이 무시 → 같은 URL로 차단', async () => {
        configManager.repo_path = '/some/path';
        configManager.remote_url = 'https://github.com/foo/bar.git';

        const result = await installCommand('https://github.com/foo/bar');

        expect(result).toBe(false);
        expect(spawnSync).not.toHaveBeenCalled();
    });

    it('다른 URL로 재install → replace 확인 프롬프트', async () => {
        configManager.repo_path = '/some/path';
        configManager.remote_url = 'https://github.com/foo/old.git';
        vi.mocked(confirm).mockResolvedValue(false);

        await installCommand('https://github.com/foo/new.git');

        expect(confirm).toHaveBeenCalled();
        expect(spawnSync).not.toHaveBeenCalled();
    });

    it('다른 URL로 재install → 확인 시 clone 실행', async () => {
        configManager.repo_path = '/some/path';
        configManager.remote_url = 'https://github.com/foo/old.git';
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        await installCommand('https://github.com/foo/new.git');

        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['clone', 'https://github.com/foo/new.git']),
            expect.anything()
        );
    });

    it('기존 repo 존재 시 백업 후 clone 성공 → 백업 삭제', async () => {
        existsSyncSpy.mockReturnValue(true);
        vi.mocked(confirm).mockResolvedValue(true);
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

        await installCommand('https://github.com/foo/bar.git');

        expect(renameSyncSpy).toHaveBeenCalled();
        expect(rmSyncSpy).toHaveBeenCalled();
    });

    it('기존 repo rename 시 EPERM → false 반환, clone 미실행', async () => {
        existsSyncSpy.mockReturnValue(true);
        renameSyncSpy.mockImplementation(() => {
            const err = new Error('EPERM') as NodeJS.ErrnoException;
            err.code = 'EPERM';
            throw err;
        });
        vi.mocked(confirm).mockResolvedValue(true);

        const result = await installCommand('https://github.com/foo/bar.git');

        expect(result).toBe(false);
        expect(spawnSync).not.toHaveBeenCalled();
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
