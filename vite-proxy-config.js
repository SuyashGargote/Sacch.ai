// Vite proxy configuration for VirusTotal API
export default {
    proxy: {
        '/api/virustotal': {
            target: 'https://www.virustotal.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/virustotal/, '/api/v3'),
            secure: true,
            configure: (proxy, _options) => {
                proxy.on('error', (err, _req, _res) => {
                    console.log('proxy error', err);
                });
                proxy.on('proxyReq', (proxyReq, req, _res) => {
                    console.log('Sending Request to the Target:', req.method, req.url);
                });
                proxy.on('proxyRes', (proxyRes, req, _res) => {
                    console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
                });
            },
        }
    }
}
