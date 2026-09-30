import { defineConfig } from 'vitest/config';
export default defineConfig({ define: { __BASE_PATH__: '"/"' }, test: { globals: true, include: ['src/**/*.test.ts'] }, resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } } });
