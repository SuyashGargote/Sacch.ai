// VirusTotal API Service for File and URL Analysis

export interface VirusTotalScanResult {
    found: boolean;
    data?: any;
    scanId?: string;
    permalink?: string;
}

export interface VirusTotalAnalysis {
    malicious: number;
    suspicious: number;
    harmless: number;
    undetected: number;
    timeout: number;
    total: number;
}

export interface VirusTotalReport {
    scanId: string;
    resource: string;
    scanDate: string;
    permalink: string;
    positives: number;
    total: number;
    analysis: VirusTotalAnalysis;
    scans: Record<string, {
        detected: boolean;
        version: string;
        result: string;
        update: string;
    }>;
}

// Upload a file to VirusTotal for scanning through our proxy
export const uploadFileToVirusTotal = async (file: File): Promise<VirusTotalScanResult> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/files', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            found: true,
            scanId: data.data.id,
            permalink: `https://www.virustotal.com/gui/file/${data.data.id}`
        };
    } catch (error) {
        console.error("File upload error:", error);
        throw error;
    }
};

// Helper function to validate URL for scanning
const validateUrlForScanning = (url: string): { valid: boolean; reason?: string } => {
    try {
        const urlObj = new URL(url);

        // Check if it's a private/internal IP
        const hostname = urlObj.hostname.toLowerCase();
        const privateRanges = [
            '127.0.0.1', 'localhost', '0.0.0.0',
            '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.',
            '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
            '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
            '169.254.', '::1', 'fc00:', 'fe80:'
        ];

        // Block private/internal IPs and localhost
        if (privateRanges.some(range => hostname.startsWith(range))) {
            return { valid: false, reason: 'Private/internal IP addresses cannot be scanned' };
        }

        // Block VirusTotal domain
        if (hostname.includes('virustotal.com')) {
            return { valid: false, reason: 'VirusTotal URLs cannot be scanned' };
        }

        // Block common security vendor domains that might restrict scanning
        const restrictedDomains = [
            'google.com', 'microsoft.com', 'apple.com', 'amazon.com',
            'facebook.com', 'meta.com', 'twitter.com', 'x.com',
            'linkedin.com', 'instagram.com', 'youtube.com'
        ];

        const matchedDomain = restrictedDomains.find(restrictedDomain =>
            hostname === restrictedDomain || hostname.endsWith('.' + restrictedDomain)
        );

        if (matchedDomain) {
            return { valid: false, reason: `Scanning ${matchedDomain} URLs is restricted` };
        }

        return { valid: true };
    } catch (error) {
        return { valid: false, reason: 'Invalid URL format' };
    }
};

// Submit a URL for scanning through our proxy
export const submitUrlToVirusTotal = async (url: string): Promise<VirusTotalScanResult> => {
    const validation = validateUrlForScanning(url);
    if (!validation.valid) {
        throw new Error(validation.reason || 'Invalid URL');
    }

    try {
        const response = await fetch('/api/urls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ url }),
        });

        if (!response.ok) {
            throw new Error(`URL submission failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            found: true,
            scanId: data.data.id,
            permalink: `https://www.virustotal.com/gui/url/${data.data.id}`
        };
    } catch (error) {
        console.error("URL submission error:", error);
        throw error;
    }
};

// Get analysis report for a file or URL through our proxy
export const getVirusTotalReport = async (resource: string, type: 'FILE' | 'URL'): Promise<VirusTotalReport | null> => {
    const endpoint = type === 'FILE'
        ? `/api/analyses/${resource}`
        : `/api/urls/${resource}`;

    try {
        const response = await fetch(endpoint, {
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log("Report response status:", response.status);

        if (!response.ok) {
            if (response.status === 404) {
                console.log("URL not found in database");
                return null; // Not found in database
            }
            const errorText = await response.text();
            console.error("Report error response:", errorText);
            throw new Error(`Report retrieval failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const attributes = data.data.attributes;

        return {
            scanId: data.data.id,
            resource: resource,
            scanDate: attributes.last_analysis_date ?
                new Date(attributes.last_analysis_date * 1000).toISOString() :
                new Date().toISOString(),
            permalink: `https://www.virustotal.com/gui/${type.toLowerCase()}/${data.data.id}`,
            positives: attributes.last_analysis_stats?.malicious || 0,
            total: (attributes.last_analysis_stats?.malicious || 0) +
                (attributes.last_analysis_stats?.suspicious || 0) +
                (attributes.last_analysis_stats?.harmless || 0) +
                (attributes.last_analysis_stats?.undetected || 0),
            analysis: attributes.last_analysis_stats || {
                malicious: 0,
                suspicious: 0,
                harmless: 0,
                undetected: 0,
                timeout: 0,
                total: 0
            },
            scans: attributes.last_analysis_results || {}
        };
    } catch (error) {
        console.error("Report retrieval error:", error);
        throw error;
    }
};

// Wait for analysis to complete (polling mechanism)
export const waitForAnalysis = async (scanId: string, maxWaitTime: number = 300000, pollInterval: number = 10000): Promise<VirusTotalReport | null> => {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        try {
            const response = await fetch(`/api/analyses/${scanId}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const stats = data.data?.attributes?.stats;

                // If analysis is complete
                if (stats && (stats.malicious + stats.suspicious + stats.harmless + stats.undetected) > 0) {
                    // Get the full report
                    const resourceId = data.data.attributes?.resource || data.data.id;
                    if (resourceId) {
                        return await getVirusTotalReport(resourceId, 'FILE');
                    }
                }
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (error) {
            console.error("Polling error:", error);
        }
    }

    throw new Error("Analysis timeout - please check back later");
};

// Comprehensive file scanning with automatic waiting
export const scanFileWithVirusTotal = async (file: File): Promise<VirusTotalReport> => {
    // First, check if file already exists in VT database
    const fileHash = await calculateFileHash(file);
    const existingReport = await getVirusTotalReport(fileHash, 'FILE');

    if (existingReport) {
        return existingReport;
    }

    // Upload new file
    const uploadResult = await uploadFileToVirusTotal(file);

    // Wait for analysis to complete
    const report = await waitForAnalysis(uploadResult.scanId!);

    if (!report) {
        throw new Error("Failed to get analysis report");
    }

    return report;
};

// Comprehensive URL scanning with automatic waiting
export const scanUrlWithVirusTotal = async (url: string): Promise<VirusTotalReport> => {
    // Validate URL before any processing
    const validation = validateUrlForScanning(url);
    if (!validation.valid) {
        throw new Error(`URL validation failed: ${validation.reason}`);
    }

    // First, check if URL already exists in VT database
    const existingReport = await getVirusTotalReport(url, 'URL');

    if (existingReport) {
        return existingReport;
    }

    // Submit new URL
    const submitResult = await submitUrlToVirusTotal(url);

    // Wait for analysis to complete
    const report = await waitForAnalysis(submitResult.scanId!);

    if (!report) {
        throw new Error("Failed to get analysis report");
    }

    return report;
};

// Helper function to calculate SHA-256 hash of a file
const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};
