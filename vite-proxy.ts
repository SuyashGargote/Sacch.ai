import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: 'https://www.virustotal.com/api/v3',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
                configure: (proxy, _options) => {
                    proxy.on('proxyReq', (proxyReq) => {
                        // Add VirusTotal API key from environment variable
                        proxyReq.setHeader('x-apikey', process.env.VIRUSTOTAL_API_KEY || '');
                    });
                }
            }
        }
    },
    // ... rest of your Vite config
});
