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

vi.mock('@/_libs/repo', () => ({
    printSaveHint: vi.fn(),
}));

const { scaffoldCommand } = await import('@/commands/scaffold-command');
const { configManager } = await import('@/_libs/config');
const { confirm } = await import('@inquirer/prompts');
const { printSaveHint } = await import('@/_libs/repo');

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

    describe('플러그인 매니페스트 검증 (커스터마이징 보존)', () => {
        beforeEach(() => {
            vol.mkdirSync(FAKE_REPO, { recursive: true });
        });

        it('valid 매니페스트 → 보존됨 (덮어쓰지 않음)', async () => {
            const customClaude = {
                name: 'my-custom-plugin',
                version: '2.5.0',
                description: 'My personalized prompt set',
                author: 'Me',
            };
            vol.mkdirSync(path.join(FAKE_REPO, '.claude-plugin'), { recursive: true });
            vol.writeFileSync(path.join(FAKE_REPO, '.claude-plugin', 'plugin.json'), JSON.stringify(customClaude));

            await scaffoldCommand(FAKE_REPO);

            const after = JSON.parse(vol.readFileSync(path.join(FAKE_REPO, '.claude-plugin', 'plugin.json'), 'utf-8') as string);
            expect(after).toEqual(customClaude);
        });

        it('invalid 매니페스트 (name 누락) → 경고 + 파일 보존', async () => {
            const broken = { version: '1.0.0' };
            vol.mkdirSync(path.join(FAKE_REPO, '.claude-plugin'), { recursive: true });
            vol.writeFileSync(path.join(FAKE_REPO, '.claude-plugin', 'plugin.json'), JSON.stringify(broken));
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await scaffoldCommand(FAKE_REPO);

            expect(warnSpy.mock.calls.flat().join('')).toContain('"name" is required');
            const after = JSON.parse(vol.readFileSync(path.join(FAKE_REPO, '.claude-plugin', 'plugin.json'), 'utf-8') as string);
            expect(after).toEqual(broken); // unchanged
            warnSpy.mockRestore();
        });

        it('깨진 JSON → 경고 + 파일 보존', async () => {
            vol.mkdirSync(path.join(FAKE_REPO, '.claude-plugin'), { recursive: true });
            vol.writeFileSync(path.join(FAKE_REPO, '.claude-plugin', 'plugin.json'), '{ not valid json');
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await scaffoldCommand(FAKE_REPO);

            expect(warnSpy.mock.calls.flat().join('')).toContain('failed to parse');
            const after = vol.readFileSync(path.join(FAKE_REPO, '.claude-plugin', 'plugin.json'), 'utf-8');
            expect(after).toBe('{ not valid json'); // unchanged
            warnSpy.mockRestore();
        });

        it('Codex 매니페스트: skills 누락 → invalid 경고', async () => {
            const broken = { name: 'foo', version: '1.0.0' }; // missing skills/mcpServers/apps
            vol.mkdirSync(path.join(FAKE_REPO, '.codex-plugin'), { recursive: true });
            vol.writeFileSync(path.join(FAKE_REPO, '.codex-plugin', 'plugin.json'), JSON.stringify(broken));
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await scaffoldCommand(FAKE_REPO);

            expect(warnSpy.mock.calls.flat().join('')).toContain('"skills" is required');
            warnSpy.mockRestore();
        });

        it('Codex 매니페스트: mcpServers 누락 → invalid 경고', async () => {
            const broken = { name: 'foo', skills: './skills/', apps: './.app.json' }; // missing mcpServers
            vol.mkdirSync(path.join(FAKE_REPO, '.codex-plugin'), { recursive: true });
            vol.writeFileSync(path.join(FAKE_REPO, '.codex-plugin', 'plugin.json'), JSON.stringify(broken));
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await scaffoldCommand(FAKE_REPO);

            expect(warnSpy.mock.calls.flat().join('')).toContain('"mcpServers" is required');
            warnSpy.mockRestore();
        });

        it('Codex 매니페스트: apps 누락 → invalid 경고', async () => {
            const broken = { name: 'foo', skills: './skills/', mcpServers: './.mcp.json' }; // missing apps
            vol.mkdirSync(path.join(FAKE_REPO, '.codex-plugin'), { recursive: true });
            vol.writeFileSync(path.join(FAKE_REPO, '.codex-plugin', 'plugin.json'), JSON.stringify(broken));
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await scaffoldCommand(FAKE_REPO);

            expect(warnSpy.mock.calls.flat().join('')).toContain('"apps" is required');
            warnSpy.mockRestore();
        });

        it('Codex 매니페스트: 4개 필드 모두 있고 valid → 보존', async () => {
            const valid = {
                name: 'my-plugin',
                version: '1.0.0',
                skills: './my-skills/',
                mcpServers: './my-mcp.json',
                apps: './my-apps.json',
            };
            vol.mkdirSync(path.join(FAKE_REPO, '.codex-plugin'), { recursive: true });
            vol.writeFileSync(path.join(FAKE_REPO, '.codex-plugin', 'plugin.json'), JSON.stringify(valid));

            await scaffoldCommand(FAKE_REPO);

            const after = JSON.parse(vol.readFileSync(path.join(FAKE_REPO, '.codex-plugin', 'plugin.json'), 'utf-8') as string);
            expect(after).toEqual(valid);
        });
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

    describe('post-scaffold save hint', () => {
        beforeEach(() => {
            vol.mkdirSync(FAKE_REPO, { recursive: true });
            configManager.repo_path = FAKE_REPO;
        });

        it('targetPath === repo_path → printSaveHint 호출', async () => {
            await scaffoldCommand(FAKE_REPO);

            expect(printSaveHint).toHaveBeenCalledWith(FAKE_REPO);
        });

        it('targetPath !== repo_path → printSaveHint 미호출', async () => {
            const OTHER_PATH = '/other/path';
            vol.mkdirSync(OTHER_PATH, { recursive: true });
            configManager.repo_path = FAKE_REPO; // registered repo is FAKE_REPO

            await scaffoldCommand(OTHER_PATH); // scaffolding a different path

            expect(printSaveHint).not.toHaveBeenCalled();
        });

        it('repo_path 미설정 → printSaveHint 미호출', async () => {
            configManager.repo_path = null;

            await scaffoldCommand(FAKE_REPO);

            expect(printSaveHint).not.toHaveBeenCalled();
        });
    });
});
