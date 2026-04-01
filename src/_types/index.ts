import { z } from 'zod';

export const ClaudeCodeConfigSchema = z.object({
    path: z.string().nullable(),
});

export const RoocodeConfigSchema = z.object({
    path: z.string().nullable(),                  // ~/.roo
    backup_path: z.string().nullish().optional(),  // ~/.roo/SET_PROMPT_BACKUP
});

export const OpenclawConfigSchema = z.object({
    path: z.string().nullable(),
    backup_path: z.string().nullish().optional(),
});

export const CodexConfigSchema = z.object({
    path: z.string().nullable(),
});

export const AntigravityConfigSchema = z.object({
    path: z.string().nullable(),
});

export const GlobalConfigSchema = z.object({
    repo_path:   z.string(),
    remote_url:  z.string().nullable(),
    claude_code: ClaudeCodeConfigSchema.nullable(),
    roocode:     RoocodeConfigSchema.nullable(),
    openclaw:    OpenclawConfigSchema.nullable(),
    codex:       CodexConfigSchema.nullish().optional(),
    antigravity: AntigravityConfigSchema.nullish().optional(),
});

export type GlobalConfig     = z.infer<typeof GlobalConfigSchema>;
export type ClaudeCodeConfig = z.infer<typeof ClaudeCodeConfigSchema>;
export type RoocodeConfig    = z.infer<typeof RoocodeConfigSchema>;
export type OpenclawConfig   = z.infer<typeof OpenclawConfigSchema>;
export type CodexConfig      = z.infer<typeof CodexConfigSchema>;
export type AntigravityConfig = z.infer<typeof AntigravityConfigSchema>;
