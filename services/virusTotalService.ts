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

// Upload a file to VirusTotal for scanning
export const uploadFileToVirusTotal = async (file: File): Promise<VirusTotalScanResult> => {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
        throw new Error("VirusTotal API Key is missing");
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('https://www.virustotal.com/api/v3/files', {
            method: 'POST',
            headers: {
                'x-apikey': apiKey,
            },
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

// Submit a URL for scanning
export const submitUrlToVirusTotal = async (url: string): Promise<VirusTotalScanResult> => {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
        throw new Error("VirusTotal API Key is missing");
    }

    const formData = new FormData();
    formData.append('url', url);

    try {
        const response = await fetch('https://www.virustotal.com/api/v3/urls', {
            method: 'POST',
            headers: {
                'x-apikey': apiKey,
            },
            body: formData
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

// Get analysis report for a file or URL
export const getVirusTotalReport = async (resource: string, type: 'FILE' | 'URL'): Promise<VirusTotalReport | null> => {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
        throw new Error("VirusTotal API Key is missing");
    }

    let endpoint = '';

    if (type === 'FILE') {
        endpoint = `https://www.virustotal.com/api/v3/files/${resource}`;
    } else {
        // For URLs, we need to encode it to base64url without padding
        const urlId = btoa(resource).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        endpoint = `https://www.virustotal.com/api/v3/urls/${urlId}`;
    }

    try {
        const response = await fetch(endpoint, {
            headers: {
                'x-apikey': apiKey,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null; // Not found in database
            }
            throw new Error(`Report retrieval failed: ${response.statusText}`);
        }

        const data = await response.json();
        const attributes = data.data.attributes;

        return {
            scanId: data.data.id,
            resource: resource,
            scanDate: new Date(attributes.last_analysis_date * 1000).toISOString(),
            permalink: `https://www.virustotal.com/gui/${type.toLowerCase()}/${data.data.id}`,
            positives: attributes.last_analysis_stats.malicious,
            total: attributes.last_analysis_stats.malicious +
                attributes.last_analysis_stats.suspicious +
                attributes.last_analysis_stats.harmless +
                attributes.last_analysis_stats.undetected,
            analysis: attributes.last_analysis_stats,
            scans: attributes.last_analysis_results
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
            const response = await fetch(`https://www.virustotal.com/api/v3/analyses/${scanId}`, {
                headers: {
                    'x-apikey': process.env.VIRUSTOTAL_API_KEY!,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const stats = data.data.attributes.stats;

                // If analysis is complete
                if (stats.malicious + stats.suspicious + stats.harmless + stats.undetected > 0) {
                    // Get the full report
                    const resourceId = data.data.attributes.resource || data.data.id;
                    return await getVirusTotalReport(resourceId, 'FILE');
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
