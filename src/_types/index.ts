import path from 'node:path';
import { z } from 'zod';

export const ClaudeCodeConfigSchema = z.object({
    
});

export const RoocodeConfigSchema = z.object({
    path: z.string().nullable(),
});

export const OpenclawConfigSchema = z.object({
    path: z.string().nullable(),
});

export const GlobalConfigSchema = z.object({
    repo_path: z.string(), // 로컬 경로 or git URL
    remote_url: z.string().nullable(), // git URL (repo_path가 로컬 경로인 경우 null)
    claude_code: ClaudeCodeConfigSchema.nullable(),
    roocode: RoocodeConfigSchema.nullable(),
    openclaw: OpenclawConfigSchema.nullable(),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export type ClaudeCodeConfig = z.infer<typeof ClaudeCodeConfigSchema>;
export type RoocodeConfig = z.infer<typeof RoocodeConfigSchema>;
export type OpenclawConfig = z.infer<typeof OpenclawConfigSchema>;
