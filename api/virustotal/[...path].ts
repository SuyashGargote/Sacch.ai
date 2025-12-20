import { VercelRequest, VercelResponse } from '@vercel/node';

const VIRUSTOTAL_API_BASE = 'https://www.virustotal.com/api/v3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS for all origins
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-apikey');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!req.method || (req.method !== 'GET' && req.method !== 'POST')) {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { path } = req.query;
        const apiKey = req.headers['x-apikey'] as string;

        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        if (!path || Array.isArray(path) && path.length === 0) {
            return res.status(400).json({ error: 'Path is required' });
        }

        // Construct the target URL
        const pathStr = Array.isArray(path) ? path.join('/') : path;
        const targetUrl = `${VIRUSTOTAL_API_BASE}/${pathStr}`;

        console.log(`Proxying request to: ${targetUrl}`);

        // Prepare fetch options
        const fetchOptions: RequestInit = {
            method: req.method,
            headers: {
                'x-apikey': apiKey,
                'Accept': 'application/json',
            },
        };

        // Handle request body for POST requests
        if (req.method === 'POST' && req.body) {
            if (req.headers['content-type']?.includes('multipart/form-data')) {
                // For file uploads, we need to handle the body differently
                fetchOptions.body = req.body;
            } else {
                fetchOptions.headers['Content-Type'] = 'application/json';
                fetchOptions.body = JSON.stringify(req.body);
            }
        }

        // Make the request to VirusTotal
        const response = await fetch(targetUrl, fetchOptions);

        // Forward the response status
        res.status(response.status);

        // Forward the response headers
        response.headers.forEach((value, name) => {
            if (name.toLowerCase() !== 'content-encoding') {
                res.setHeader(name, value);
            }
        });

        // Forward the response body
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
            const data = await response.json();
            return res.json(data);
        } else {
            const data = await response.text();
            return res.send(data);
        }

    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
