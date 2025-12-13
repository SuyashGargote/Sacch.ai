import { GoogleGenAI, Type } from "@google/genai";
import { FactCheckResult, ScamAnalysisResult, DeepfakeResult, Verdict, GroundingSource } from "../types";
import { scanFileWithVirusTotal, scanUrlWithVirusTotal, VirusTotalReport } from "./virusTotalService";

// Helper to initialize AI client lazily
const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Helper: Google Fact Check Tools API ---

const searchFactCheckTools = async (query: string): Promise<{ context: string, sources: GroundingSource[] }> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { context: "", sources: [] };

  try {
    const response = await fetch(
      `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&key=${apiKey}`
    );

    if (!response.ok) return { context: "", sources: [] };

    const data = await response.json();
    let context = "";
    const sources: GroundingSource[] = [];

    if (data.claims && Array.isArray(data.claims)) {
      context = "Existing verified fact checks found via Google Fact Check Tools API:\n";
      data.claims.forEach((claim: any) => {
        const review = claim.claimReview?.[0];
        if (review) {
          const publisher = review.publisher?.name || "Unknown Source";
          const rating = review.textualRating || "Unspecified";
          context += `- Claim: "${claim.text}"\n  Rating: ${rating} by ${publisher}\n`;

          if (review.url) {
            sources.push({
              title: `[Fact Check] ${publisher}: ${review.title || claim.text}`,
              uri: review.url
            });
          }
        }
      });
      context += "\n";
    }

    return { context, sources };
  } catch (error) {
    console.error("Fact Check Tools API error:", error);
    return { context: "", sources: [] };
  }
};

// --- Helper: VirusTotal API ---

const checkVirusTotal = async (resource: string, type: 'URL' | 'FILE'): Promise<any> => {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    console.warn("VirusTotal API Key is missing in environment variables (VIRUSTOTAL_API_KEY). Skipping threat database check.");
    return null;
  }

  try {
    let endpoint = '';
    let method = 'GET';

    if (type === 'URL') {
      // For URLs, we need to encode it to base64url without padding
      const urlId = btoa(resource).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      endpoint = `https://www.virustotal.com/api/v3/urls/${urlId}`;
    } else {
      // For Files, resource is the SHA-256 hash
      endpoint = `https://www.virustotal.com/api/v3/files/${resource}`;
    }

    const response = await fetch(endpoint, {
      method: method,
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // If 404, it means VT hasn't seen this file/url before
      if (response.status === 404) return { found: false };
      throw new Error(`VirusTotal API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return { found: true, data: data.data };
  } catch (error) {
    console.error("VirusTotal check failed:", error);
    return null; // Fail gracefully
  }
};


// --- Fact Check Service ---

export const checkFactWithGemini = async (statement: string): Promise<FactCheckResult> => {
  try {
    const ai = getAI();
    // 1. Gather context from Google Fact Check Tools API
    const factCheckData = await searchFactCheckTools(statement);

    // 2. Query Gemini with Fact Check Context + Google Search Grounding
    // Note: responseMimeType: "application/json" cannot be used with googleSearch tool.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Verify this claim: "${statement}". 
      
      ${factCheckData.context ? `CONSIDER THESE EXISTING FACT CHECKS AS STRONG EVIDENCE:\n${factCheckData.context}` : ''}

      Use Google Search to find recent and relevant information. 
      Determine if it is True, False, or Uncertain/Context Missing. 
      
      IMPORTANT: You must output the response in this exact plain text format:
      Verdict: [TRUE / FALSE / UNCERTAIN]
      Explanation:
      **Overview**
      [Provide a concise summary of the claim and the verification status.]
      
      **Evidence Analysis**
      [Detail the evidence found, citing specific details from search results. Discuss any conflicting reports.]
      
      **Context & Nuance**
      [Explain the context, origin of the claim, or why it might be misleading.]
      
      **Conclusion**
      [Final wrap-up sentence.]`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Manual Parsing of Text Response
    let verdict = Verdict.UNCERTAIN;
    let explanation = text;

    const verdictMatch = text.match(/Verdict:\s*(TRUE|FALSE|UNCERTAIN)/i);
    if (verdictMatch) {
      const v = verdictMatch[1].toUpperCase();
      if (v === 'TRUE') verdict = Verdict.TRUE;
      if (v === 'FALSE') verdict = Verdict.FALSE;

      // Attempt to extract explanation separate from verdict
      const explanationMatch = text.match(/Explanation:\s*([\s\S]+)/i);
      if (explanationMatch) {
        explanation = explanationMatch[1].trim();
      }
    }

    // Extract unique sources from Gemini Search
    const geminiSources: GroundingSource[] = [];
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web?.uri && chunk.web?.title) {
        if (!geminiSources.some(s => s.uri === chunk.web.uri)) {
          geminiSources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      }
    });

    // Combine sources (Fact Check API + Gemini Search), filtering duplicates
    const allSources = [...factCheckData.sources];
    geminiSources.forEach(gs => {
      if (!allSources.some(as => as.uri === gs.uri)) {
        allSources.push(gs);
      }
    });

    return {
      verdict: verdict,
      explanation: explanation,
      sources: allSources
    };

  } catch (error) {
    console.error("Fact check error:", error);
    throw new Error("Failed to verify fact. Please try again.");
  }
};

// --- Enhanced VirusTotal + Gemini Integration Services ---

// Comprehensive file analysis with VirusTotal scanning and Gemini reporting
export const analyzeFileWithVirusTotalAndGemini = async (file: File): Promise<ScamAnalysisResult> => {
  try {
    // 1. Scan file with VirusTotal
    const vtReport = await scanFileWithVirusTotal(file);

    // 2. Generate comprehensive context from VT results
    const vtContext = generateVirusTotalContext(vtReport, 'FILE');

    // 3. Use Gemini to generate detailed report
    const ai = getAI();
    const prompt = `Analyze this file security report and provide a comprehensive assessment.

    File Information:
    - Name: ${file.name}
    - Size: ${(file.size / 1024).toFixed(2)} KB
    - Type: ${file.type || 'Unknown'}
    
    ${vtContext}
    
    Based on the VirusTotal threat intelligence above and your security knowledge, provide a detailed security analysis.
    
    Output Format (Plain Text):
    Score: [0-100] (100 = Safe, 0 = Malicious)
    Verdict: [SAFE / SUSPICIOUS / MALICIOUS]
    
    Analysis:
    ### Executive Summary
    [Concise summary of the threat level and file characteristics]
    
    ### Key Risk Factors
    - [Risk factor 1 with specific details]
    - [Risk factor 2 with specific details]
    
    ### Technical Analysis
    [Detailed analysis of VirusTotal findings, specific malware families detected, attack vectors, etc.]
    
    ### Security Recommendations
    - [Action 1 - Specific and actionable]
    - [Action 2]
    - [Action 3]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const textRes = response.text || "";

    // Parse the response
    let score = 50;
    let verdict = Verdict.SUSPICIOUS;
    let analysis = textRes;
    let recommendations = ["Proceed with caution."];

    // Parse Score
    const scoreMatch = textRes.match(/Score:\s*(\d+)/i);
    if (scoreMatch) score = parseInt(scoreMatch[1], 10);

    // Parse Verdict
    const verdictMatch = textRes.match(/Verdict:\s*(SAFE|SUSPICIOUS|MALICIOUS)/i);
    if (verdictMatch) {
      const v = verdictMatch[1].toUpperCase();
      if (v === 'SAFE') verdict = Verdict.SAFE;
      if (v === 'MALICIOUS') verdict = Verdict.MALICIOUS;
    }

    // Parse Analysis
    const analysisMatch = textRes.match(/Analysis:\s*([\s\S]+?)(?=###|$)/i);
    if (analysisMatch) analysis = analysisMatch[1].trim();

    // Parse Recommendations
    const recMatch = textRes.match(/### Security Recommendations\s*([\s\S]+)/i);
    if (recMatch) {
      recommendations = recMatch[1]
        .split('\n')
        .map(s => s.trim().replace(/^-\s*/, '').replace(/^\*\s*/, '').replace(/^\d+\.\s*/, ''))
        .filter(s => s.length > 0);
    }

    return {
      score,
      verdict,
      analysis,
      recommendations,
      vtStats: vtReport.analysis,
      permalink: vtReport.permalink
    };

  } catch (error) {
    console.error("File analysis error:", error);
    throw new Error("Failed to analyze file. Please try again.");
  }
};

// Comprehensive URL analysis with VirusTotal scanning and Gemini reporting
export const analyzeUrlWithVirusTotalAndGemini = async (url: string): Promise<ScamAnalysisResult> => {
  try {
    // 1. Scan URL with VirusTotal
    const vtReport = await scanUrlWithVirusTotal(url);

    // 2. Generate comprehensive context from VT results
    const vtContext = generateVirusTotalContext(vtReport, 'URL');

    // 3. Use Gemini to generate detailed report with search capabilities
    const ai = getAI();
    const prompt = `Analyze this URL security report and provide a comprehensive assessment.

    Target URL: "${url}"
    
    ${vtContext}
    
    Using the VirusTotal threat intelligence above, Google Search results, and your security knowledge, provide a detailed security analysis.
    
    Output Format (Plain Text):
    Score: [0-100] (100 = Safe, 0 = Malicious)
    Verdict: [SAFE / SUSPICIOUS / MALICIOUS]
    
    Analysis:
    ### Executive Summary
    [Concise summary of the threat level and website characteristics]
    
    ### Key Risk Factors
    - [Risk factor 1 with specific details]
    - [Risk factor 2 with specific details]
    
    ### Technical Analysis
    [Detailed analysis of VirusTotal findings, specific threats detected, reputation issues, etc.]
    
    ### Security Recommendations
    - [Action 1 - Specific and actionable]
    - [Action 2]
    - [Action 3]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const textRes = response.text || "";

    // Parse the response
    let score = 50;
    let verdict = Verdict.SUSPICIOUS;
    let analysis = textRes;
    let recommendations = ["Proceed with caution."];

    // Parse Score
    const scoreMatch = textRes.match(/Score:\s*(\d+)/i);
    if (scoreMatch) score = parseInt(scoreMatch[1], 10);

    // Parse Verdict
    const verdictMatch = textRes.match(/Verdict:\s*(SAFE|SUSPICIOUS|MALICIOUS)/i);
    if (verdictMatch) {
      const v = verdictMatch[1].toUpperCase();
      if (v === 'SAFE') verdict = Verdict.SAFE;
      if (v === 'MALICIOUS') verdict = Verdict.MALICIOUS;
    }

    // Parse Analysis
    const analysisMatch = textRes.match(/Analysis:\s*([\s\S]+?)(?=###|$)/i);
    if (analysisMatch) analysis = analysisMatch[1].trim();

    // Parse Recommendations
    const recMatch = textRes.match(/### Security Recommendations\s*([\s\S]+)/i);
    if (recMatch) {
      recommendations = recMatch[1]
        .split('\n')
        .map(s => s.trim().replace(/^-\s*/, '').replace(/^\*\s*/, '').replace(/^\d+\.\s*/, ''))
        .filter(s => s.length > 0);
    }

    return {
      score,
      verdict,
      analysis,
      recommendations,
      vtStats: vtReport.analysis,
      permalink: vtReport.permalink
    };

  } catch (error) {
    console.error("URL analysis error:", error);
    throw new Error("Failed to analyze URL. Please try again.");
  }
};

// Helper function to generate context from VirusTotal report
const generateVirusTotalContext = (report: VirusTotalReport, type: 'FILE' | 'URL'): string => {
  const stats = report.analysis;
  const total = stats.malicious + stats.suspicious + stats.harmless + stats.undetected;
  const maliciousRatio = total > 0 ? (stats.malicious / total * 100).toFixed(1) : '0';

  let context = `
### VIRUSTOTAL THREAT INTELLIGENCE REPORT:
- **Scan Date**: ${new Date(report.scanDate).toLocaleString()}
- **Total Engines**: ${total}
- **Malicious Detections**: ${stats.malicious} (${maliciousRatio}%)
- **Suspicious Detections**: ${stats.suspicious}
- **Harmless Detections**: ${stats.harmless}
- **Undetected**: ${stats.undetected}
- **Full Report**: ${report.permalink}

`;

  // Add specific detection details if malicious or suspicious
  if (stats.malicious > 0 || stats.suspicious > 0) {
    context += "\n### SPECIFIC THREAT DETECTIONS:\n";
    Object.entries(report.scans).forEach(([engine, result]) => {
      if (result.detected) {
        context += `- **${engine}**: ${result.result}\n`;
      }
    });
    context += "\n";
  }

  // Add critical instruction for Gemini
  context += `
**CRITICAL ANALYSIS INSTRUCTIONS**: 
- If malicious detections > 0, verdict MUST be SUSPICIOUS or MALICIOUS
- If malicious detections > 5, verdict MUST be MALICIOUS
- Consider the specific threat names and attack vectors in your analysis
- Provide context about what the detected threats typically do
`;

  return context;
};

// --- Scam Detection Service ---

export const analyzeScamContent = async (text: string, type: 'EMAIL' | 'URL' | 'FILE'): Promise<ScamAnalysisResult> => {
  const ai = getAI();

  // URL or FILE Analysis
  if (type === 'URL' || type === 'FILE') {
    // 1. Check VirusTotal
    const vtReport = await checkVirusTotal(text, type);

    let vtContext = "";
    let vtStats = undefined;

    if (vtReport && vtReport.found) {
      const stats = vtReport.data.attributes.last_analysis_stats;
      vtStats = stats;

      const total = stats.malicious + stats.suspicious + stats.harmless + stats.undetected;

      vtContext = `
      ### VIRUSTOTAL THREAT INTELLIGENCE (Priority):
      - **Malicious Detections**: ${stats.malicious} / ${total} engines
      - **Suspicious Detections**: ${stats.suspicious} engines
      - **Harmless Detections**: ${stats.harmless} engines
      
      **CRITICAL INSTRUCTION**: 
      If 'Malicious' count > 0, the verdict MUST be SUSPICIOUS or MALICIOUS unless there is overwhelming evidence otherwise.
      You MUST interpret these stats in the "Technical Analysis" section of your report.
      `;
    } else if (vtReport && !vtReport.found) {
      vtContext = `
      ### VIRUSTOTAL THREAT INTELLIGENCE:
      - Status: Not found in database. 
      - Implication: This is a new or unknown file/URL. Proceed with caution and rely on heuristic analysis.
      `;
    } else {
      vtContext = "VIRUSTOTAL REPORT: Unavailable (API Key missing or error). Rely on your internal knowledge and heuristic analysis.";
    }

    const prompt = `Perform a comprehensive security assessment on this ${type}.
    Target Identifier: "${text}"
    
    ${vtContext}
    
    Using the Threat Intelligence above and your own knowledge base${type === 'URL' ? ' (and Google Search results)' : ''}, provide a comprehensive security report.
    
    Output Format (Plain Text):
    Score: [0-100] (100 = Safe, 0 = Malicious)
    Verdict: [SAFE / SUSPICIOUS / MALICIOUS]
    
    Analysis:
    ### Executive Summary
    [Concise summary of the threat level and identity of the file/url]
    
    ### Key Risk Factors
    - [Risk 1]
    - [Risk 2]
    
    ### Technical Analysis
    [Explain the VirusTotal findings. E.g., "Flagged by X security vendors as Phishing/Malware". Describe the specific attack vector if known.]
    
    Recommendations:
    - [Action 1 - Specific to the threat found]
    - [Action 2]
    - [Action 3]
    `;

    try {
      const config: any = {};
      if (type === 'URL') {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: config
      });

      const textRes = response.text || "";

      // Defaults
      let score = 50;
      let verdict = Verdict.SUSPICIOUS;
      let analysis = textRes;
      let recommendations = ["Proceed with caution."];

      // Parse Score
      const scoreMatch = textRes.match(/Score:\s*(\d+)/i);
      if (scoreMatch) score = parseInt(scoreMatch[1], 10);

      // Parse Verdict
      const verdictMatch = textRes.match(/Verdict:\s*(SAFE|SUSPICIOUS|MALICIOUS)/i);
      if (verdictMatch) {
        const v = verdictMatch[1].toUpperCase();
        if (v === 'SAFE') verdict = Verdict.SAFE;
        if (v === 'MALICIOUS') verdict = Verdict.MALICIOUS;
      }

      // Parse Analysis
      const analysisMatch = textRes.match(/Analysis:\s*([\s\S]+?)(?=Recommendations:|$)/i);
      if (analysisMatch) analysis = analysisMatch[1].trim();

      // Parse Recommendations
      const recMatch = textRes.match(/Recommendations:\s*([\s\S]+)/i);
      if (recMatch) {
        // Split by newlines, remove bullets, filter empty
        recommendations = recMatch[1]
          .split('\n')
          .map(s => s.trim().replace(/^-\s*/, '').replace(/^\*\s*/, '').replace(/^\d+\.\s*/, ''))
          .filter(s => s.length > 0);
      }

      return { score, verdict, analysis, recommendations, vtStats };

    } catch (error) {
      console.error(`${type} Scam analysis error:`, error);
      throw new Error(`Failed to analyze ${type}.`);
    }
  }

  // Email Analysis
  else {
    const prompt = `Analyze the following email text for indicators of phishing, fraud, or scams.
    Input Text: "${text}"
    
    Provide the response in JSON.
    For the "analysis" field, use Markdown formatting, strictly adhering to these headers:
    ### Executive Summary
    ...
    ### Key Red Flags
    ...
    ### Intent Analysis
    ...
    
    For "recommendations", provide a list of clear actions.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "Safety score 0-100 where 100 is perfectly safe" },
              verdict: { type: Type.STRING, enum: [Verdict.SAFE, Verdict.SUSPICIOUS, Verdict.MALICIOUS] },
              analysis: { type: Type.STRING, description: "Markdown formatted detailed analysis with ### headers" },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      return {
        score: result.score ?? 50,
        verdict: result.verdict || Verdict.SUSPICIOUS,
        analysis: result.analysis || "### Analysis Unavailable\nCould not process the text.",
        recommendations: result.recommendations || ["Proceed with caution."]
      };

    } catch (error) {
      console.error("Scam analysis error:", error);
      throw new Error("Failed to analyze content.");
    }
  }
};

// --- Deepfake Detection Service ---

export const analyzeDeepfakeMedia = async (base64Data: string, mimeType: string): Promise<DeepfakeResult> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Multimodal supported
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: `Analyze this media file for signs of deepfake manipulation, AI generation, or synthetic content.
            
            If it is an IMAGE:
            Look for visual artifacts like warped backgrounds, asymmetrical eyes/glasses/ears, unnatural skin textures (too smooth), inconsistent lighting/shadows, or strange hands/fingers.
            
            If it is AUDIO/VIDEO:
            Look for:
            1. Unnatural blinking or facial movements.
            2. Lip-sync discrepancies.
            3. Lighting inconsistencies or artifacts (blurring around edges).
            4. Audio artifacts (robotic tones, lack of breathing).
            
            Return a JSON assessment.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: { type: Type.STRING, enum: [Verdict.LIKELY_REAL, Verdict.LIKELY_FAKE, Verdict.UNCERTAIN] },
            confidence: { type: Type.NUMBER, description: "Confidence score 0-100" },
            technicalDetails: { type: Type.STRING },
            visualArtifacts: { type: Type.ARRAY, items: { type: Type.STRING } },
            audioArtifacts: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      verdict: result.verdict || Verdict.UNCERTAIN,
      confidence: result.confidence ?? 0,
      technicalDetails: result.technicalDetails || "Could not process media details.",
      visualArtifacts: result.visualArtifacts || [],
      audioArtifacts: result.audioArtifacts || []
    };

  } catch (error) {
    console.error("Deepfake analysis error:", error);
    throw new Error("Failed to analyze media. File might be too large or format unsupported.");
  }
};