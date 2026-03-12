import { z } from 'zod';

export const GlobalConfigSchema = z.object({
    repo_path: z.string(), // 로컬 경로 or git URL
    remote_url: z.string().optional(),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
