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
    configManager: {
        repo_path: null,
        remote_url: null,
        save: vi.fn(),
        init: vi.fn(),
        exists: vi.fn(),
        reload: vi.fn(),
    }
}));

const { loadCommand } = await import('@/commands/load-command');
const { confirm } = await import('@inquirer/prompts');
const { spawnSync } = await import('child_process');
const { configManager } = await import('@/_libs/config');

// process.exit spy — 실제 프로세스 종료 방지
const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
}) as any);

describe('loadCommand — 로컬 경로', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-prompt-test-'));
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
        configManager.repo_path = tmpDir;
        configManager.remote_url = null;
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
        const file = path.join(tmpDir, 'not-a-dir.txt');
        fs.writeFileSync(file, 'test');
        await loadCommand(file);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('사용자가 구조 생성 거부 → 파일 미생성, setConfig는 호출', async () => {
        vi.mocked(confirm).mockResolvedValue(false);

        await loadCommand(tmpDir);

        expect(fs.existsSync(path.join(tmpDir, 'skills'))).toBe(false);
        expect(fs.existsSync(path.join(tmpDir, 'SET_PROMPT_GUIDE.md'))).toBe(false);
        expect(configManager.save).toHaveBeenCalledWith({ repo_path: tmpDir });
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

        const guidePath = path.join(tmpDir, 'SET_PROMPT_GUIDE.md');
        expect(fs.existsSync(guidePath)).toBe(true);
        const content = fs.readFileSync(guidePath, 'utf-8');
        expect(content).toContain('# set-prompt');
    });

    it('이미 존재하는 디렉토리는 스킵 (기존 파일 유지)', async () => {
        const skillsDir = path.join(tmpDir, 'skills');
        fs.mkdirSync(skillsDir);
        fs.writeFileSync(path.join(skillsDir, 'test.md'), 'hello');

        vi.mocked(confirm).mockResolvedValue(true);
        await loadCommand(tmpDir);

        expect(fs.readFileSync(path.join(skillsDir, 'test.md'), 'utf-8')).toBe('hello');
    });

    it('SET_PROMPT_GUIDE.md 이미 존재 + 덮어쓰기 거부 → 기존 파일 유지', async () => {
        const guidePath = path.join(tmpDir, 'SET_PROMPT_GUIDE.md');
        fs.writeFileSync(guidePath, 'old content');

        vi.mocked(confirm).mockImplementation(async (opts: any) => {
            if (opts.message.includes('overwrite')) return false;
            return true;
        });

        await loadCommand(tmpDir);
        expect(fs.readFileSync(guidePath, 'utf-8')).toBe('old content');
    });

    it('SET_PROMPT_GUIDE.md 이미 존재 + 덮어쓰기 확인 → .bak 생성 후 교체', async () => {
        const guidePath = path.join(tmpDir, 'SET_PROMPT_GUIDE.md');
        fs.writeFileSync(guidePath, 'old content');

        vi.mocked(confirm).mockResolvedValue(true);

        await loadCommand(tmpDir);

        expect(fs.readFileSync(guidePath, 'utf-8')).not.toBe('old content');
        expect(fs.existsSync(guidePath + '.bak')).toBe(true);
        expect(fs.readFileSync(guidePath + '.bak', 'utf-8')).toBe('old content');
    });

    it('setConfig에 올바른 repo_path 전달', async () => {
        vi.mocked(confirm).mockResolvedValue(true);
        await loadCommand(tmpDir);

        expect(configManager.save).toHaveBeenCalledWith({ repo_path: tmpDir });
    });
});

describe('loadCommand — git URL', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(configManager.save).mockReturnValue(true);
        // git clone의 spawnSync 결과를 성공으로 모킹
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);
        configManager.repo_path = '/some/path';
        configManager.remote_url = 'https://github.com/foo/bar.git';
        exitSpy.mockClear();
    });

    it('https git URL → spawnSync clone 호출', async () => {
        const gitUrl = 'https://github.com/foo/my-prompts.git';
        await loadCommand(gitUrl);

        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            ['clone', gitUrl, expect.any(String)],
            { stdio: 'inherit' }
        );
    });

    it('git URL → setConfig에 remote_url 포함', async () => {
        const gitUrl = 'https://github.com/foo/my-prompts.git';
        await loadCommand(gitUrl);

        expect(configManager.save).toHaveBeenCalledWith(
            expect.objectContaining({ remote_url: gitUrl })
        );
    });

    it('clone 실패 → process.exit(1)', async () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);

        const gitUrl = 'https://github.com/foo/my-prompts.git';
        await loadCommand(gitUrl);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('ssh git URL 인식 → clone 호출', async () => {
        await loadCommand('git@github.com:foo/bar.git');

        expect(spawnSync).toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['clone']),
            expect.anything()
        );
    });
});