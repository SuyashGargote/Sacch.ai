export enum AppMode {
  FACT_CHECK = 'FACT_CHECK',
  SCAM_DETECTOR = 'SCAM_DETECTOR',
  DEEPFAKE_DETECTOR = 'DEEPFAKE_DETECTOR',
  VOICE_ASSISTANT = 'VOICE_ASSISTANT',
  SECURITY_SCANNER = 'SECURITY_SCANNER'
}

export enum Verdict {
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  UNCERTAIN = 'UNCERTAIN',
  SAFE = 'SAFE',
  SUSPICIOUS = 'SUSPICIOUS',
  MALICIOUS = 'MALICIOUS',
  LIKELY_REAL = 'LIKELY_REAL',
  LIKELY_FAKE = 'LIKELY_FAKE'
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface FactCheckResult {
  verdict: Verdict;
  explanation: string;
  sources: GroundingSource[];
}

export interface ScamAnalysisResult {
  score: number; // 0 to 100 (100 being safe, 0 being scam)
  verdict: Verdict;
  analysis: string;
  recommendations: string[];
  vtStats?: {
    malicious: number;
    suspicious: number;
    harmless: number;
    undetected: number;
  };
  permalink?: string;
}

export interface DeepfakeResult {
  verdict: Verdict;
  confidence: number;
  technicalDetails: string;
  visualArtifacts: string[];
  audioArtifacts: string[];
}