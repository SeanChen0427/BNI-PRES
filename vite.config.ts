import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/BNI-PRES/' : '/',
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  plugins: [react()],
});
