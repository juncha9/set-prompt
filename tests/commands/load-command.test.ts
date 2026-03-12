import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('@inquirer/prompts', () => ({ confirm: vi.fn() }));
vi.mock('child_process', () => ({ spawnSync: vi.fn() }));
vi.mock('ora', () => ({
    default: vi.fn(() => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
    })),
}));
vi.mock('@/_libs/config', () => ({
    getConfig: vi.fn(),
    setConfig: vi.fn(),
}));

const { loadCommand } = await import('@/commands/load-command');
const { confirm } = await import('@inquirer/prompts');
const { spawnSync } = await import('child_process');
const { setConfig, getConfig } = await import('@/_libs/config');

// process.exit spy — 실제 프로세스 종료 방지
const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
}) as any);

describe('loadCommand — 로컬 경로', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-prompt-test-'));
        vi.clearAllMocks();
        vi.mocked(setConfig).mockReturnValue(true);
        vi.mocked(getConfig).mockReturnValue({ repo_path: tmpDir });
        exitSpy.mockClear();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('존재하지 않는 경로 → process.exit(1)', async () => {
        await loadCommand('/absolutely/nonexistent/path');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('파일 경로(디렉토리 아님) → process.exit(1)', async () => {
        const filePath = path.join(tmpDir, 'not-a-dir.txt');
        fs.writeFileSync(filePath, 'content');

        await loadCommand(filePath);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('사용자가 구조 생성 거부 → 파일 미생성, setConfig는 호출', async () => {
        vi.mocked(confirm).mockResolvedValue(false);

        await loadCommand(tmpDir);

        expect(fs.existsSync(path.join(tmpDir, 'skills'))).toBe(false);
        expect(fs.existsSync(path.join(tmpDir, 'SET_PROMPT_GUIDE.md'))).toBe(false);
        expect(setConfig).toHaveBeenCalledWith({ repo_path: tmpDir });
    });

    it('사용자가 구조 생성 확인 → skills/commands/hooks 생성', async () => {
        vi.mocked(confirm).mockResolvedValue(true);

        await loadCommand(tmpDir);

        expect(fs.existsSync(path.join(tmpDir, 'skills'))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, 'commands'))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, 'hooks'))).toBe(true);
    });

    it('사용자가 구조 생성 확인 → SET_PROMPT_GUIDE.md 생성', async () => {
        vi.mocked(confirm).mockResolvedValue(true);

        await loadCommand(tmpDir);

        expect(fs.existsSync(path.join(tmpDir, 'SET_PROMPT_GUIDE.md'))).toBe(true);
        const content = fs.readFileSync(path.join(tmpDir, 'SET_PROMPT_GUIDE.md'), 'utf-8');
        expect(content.length).toBeGreaterThan(0);
    });

    it('이미 존재하는 디렉토리는 스킵 (기존 파일 유지)', async () => {
        vi.mocked(confirm).mockResolvedValue(true);
        fs.mkdirSync(path.join(tmpDir, 'skills'));
        fs.writeFileSync(path.join(tmpDir, 'skills', 'existing.md'), '# existing');

        await loadCommand(tmpDir);

        expect(fs.existsSync(path.join(tmpDir, 'skills', 'existing.md'))).toBe(true);
    });

    it('SET_PROMPT_GUIDE.md 이미 존재 + 덮어쓰기 거부 → 기존 파일 유지', async () => {
        const guidePath = path.join(tmpDir, 'SET_PROMPT_GUIDE.md');
        fs.writeFileSync(guidePath, '# 기존 가이드');

        // 첫 번째 confirm(구조 생성) → true, 두 번째 confirm(덮어쓰기) → false
        vi.mocked(confirm)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);

        await loadCommand(tmpDir);

        expect(fs.readFileSync(guidePath, 'utf-8')).toBe('# 기존 가이드');
    });

    it('SET_PROMPT_GUIDE.md 이미 존재 + 덮어쓰기 확인 → .bak 생성 후 교체', async () => {
        const guidePath = path.join(tmpDir, 'SET_PROMPT_GUIDE.md');
        fs.writeFileSync(guidePath, '# 기존 가이드');

        // 첫 번째 confirm(구조 생성) → true, 두 번째 confirm(덮어쓰기) → true
        vi.mocked(confirm)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(true);

        await loadCommand(tmpDir);

        expect(fs.existsSync(guidePath + '.bak')).toBe(true);
        expect(fs.readFileSync(guidePath + '.bak', 'utf-8')).toBe('# 기존 가이드');
        expect(fs.readFileSync(guidePath, 'utf-8')).not.toBe('# 기존 가이드');
    });

    it('setConfig에 올바른 repo_path 전달', async () => {
        vi.mocked(confirm).mockResolvedValue(false);

        await loadCommand(tmpDir);

        expect(setConfig).toHaveBeenCalledWith({ repo_path: tmpDir });
    });
});

describe('loadCommand — git URL', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(setConfig).mockReturnValue(true);
        vi.mocked(getConfig).mockReturnValue({ repo_path: '/some/path', remote_url: 'https://github.com/foo/bar.git' });
        vi.mocked(confirm).mockResolvedValue(false); // setupRepo 스킵
        exitSpy.mockClear();
    });

    it('https git URL → spawnSync clone 호출', async () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 0, stderr: null } as any);

        const gitUrl = 'https://github.com/foo/my-prompts.git';
        await loadCommand(gitUrl);

        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            ['clone', gitUrl, expect.any(String)],
            { stdio: 'pipe' },
        );
    });

    it('git URL → setConfig에 remote_url 포함', async () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 0, stderr: null } as any);

        const gitUrl = 'https://github.com/foo/my-prompts.git';
        await loadCommand(gitUrl);

        expect(setConfig).toHaveBeenCalledWith(
            expect.objectContaining({ remote_url: gitUrl }),
        );
    });

    it('clone 실패 → process.exit(1)', async () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 1, stderr: Buffer.from('error') } as any);

        const gitUrl = 'https://github.com/foo/my-prompts.git';
        await loadCommand(gitUrl);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('ssh git URL 인식 → clone 호출', async () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 0, stderr: null } as any);

        await loadCommand('git@github.com:foo/bar.git');

        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['clone']),
            expect.any(Object),
        );
    });
});
