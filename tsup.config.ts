import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    outDir: 'dist',
    clean: true,
    target: 'node18',
    splitting: true,
    sourcemap: true,
    banner: {
        js: '#!/usr/bin/env node',
    },
});
