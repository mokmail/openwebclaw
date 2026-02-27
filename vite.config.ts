import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env files based on mode
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Get proxy targets from environment or use defaults
  // These are optional - if not set, proxy endpoints won't be configured
  const ollamaTarget = env.VITE_OLLAMA_URL || process.env.OLLAMA_URL || '';
  const openwebuiTarget = env.VITE_OPENWEBUI_URL || process.env.OPENWEBUI_URL || '';

  // Determine if running in Docker (check for common Docker indicators)
  const isDocker = process.env.DOCKER_ENV === 'true' || process.env.CONTAINER_ENV === 'docker';

  // Build proxy configuration dynamically based on configured targets
  const proxyConfig: Record<string, any> = {};

  if (ollamaTarget) {
    proxyConfig['/api/ollama'] = {
      target: ollamaTarget,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
      configure: (proxy) => {
        proxy.on('error', (err) => {
          console.warn('⚠️ Ollama proxy error:', err.message);
        });
      },
    };
  }

  if (openwebuiTarget) {
    proxyConfig['/api/openwebui'] = {
      target: openwebuiTarget,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/openwebui/, ''),
      configure: (proxy) => {
        proxy.on('error', (err) => {
          console.warn('⚠️ OpenWebUI proxy error:', err.message);
        });
      },
    };
  }

  return {
    server: {
      // In Docker, bind to all interfaces; locally, bind to localhost
      host: isDocker ? '0.0.0.0' : '127.0.0.1',
      port: 5173,
      allowedHosts: ['all', 'localhost', '0.0.0.0', 'synapse'],
      proxy: proxyConfig,
    },
    preview: {
      // Preview server configuration (used by vite preview)
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: ['all', 'localhost', '0.0.0.0'],
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false,
        },
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'OpenWebClaw',
          short_name: 'OpenWebClaw',
          description: 'Browser-native personal AI assistant',
          theme_color: '#1a1a2e',
          background_color: '#1a1a2e',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    build: {
      target: 'es2022',
      outDir: 'dist',
    },
    worker: {
      format: 'es',
    },
    // Define global constants for the app
    define: {

    },
  };
});