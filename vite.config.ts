import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const externalAssets = Boolean(process.env.VITE_ASSET_BASE_URL || env.VITE_ASSET_BASE_URL);
  return {
    base: './',
    publicDir: externalAssets ? false : 'public',
    server: { port: 4173, strictPort: true },
    preview: { port: 4174, strictPort: true },
    build: { chunkSizeWarningLimit: 650 },
  };
});