import React, { useState, useRef } from 'react';
import { Upload, Link, Shield, AlertTriangle, CheckCircle, XCircle, FileUp, X, ExternalLink, Activity, Globe, FileText, Info, AlertCircle, Lock, Eye, Zap, Target } from 'lucide-react';
import { analyzeFileWithVirusTotalAndGemini, analyzeUrlWithVirusTotalAndGemini } from '../services/geminiService';
import { ScamAnalysisResult, Verdict } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

const SecurityScanner: React.FC = () => {
  const [scanType, setScanType] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScamAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 32 * 1024 * 1024) {
        alert("File too large. Max 32MB.");
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleScan = async () => {
    if (scanType === 'file' && !file) return;
    if (scanType === 'url' && !url.trim()) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      let data: ScamAnalysisResult;
      
      if (scanType === 'file') {
        data = await analyzeFileWithVirusTotalAndGemini(file!);
      } else {
        data = await analyzeUrlWithVirusTotalAndGemini(url);
      }
      
      setResult(data);
    } catch (error) {
      console.error('Scan error:', error);
      alert(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getVerdictColor = (v: Verdict) => {
    if (v === Verdict.MALICIOUS) return 'text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30';
    if (v === Verdict.SUSPICIOUS) return 'text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30';
    return 'text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30';
  };

  const getVerdictIcon = (v: Verdict) => {
    if (v === Verdict.MALICIOUS) return <XCircle size={24} />;
    if (v === Verdict.SUSPICIOUS) return <AlertTriangle size={24} />;
    return <CheckCircle size={24} />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###') && trimmed.length < 100) {
        const headerText = trimmed.replace(/^###\s*/, '');
        return (
          <h4 key={i} className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-6 mb-3">
            {headerText}
          </h4>
        );
      }
      
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return (
          <li key={i} className="text-slate-600 dark:text-slate-300 ml-4 mb-2 list-disc">
            {trimmed.replace(/^[-*]\s*/, '')}
          </li>
        );
      }
      
      return (
        <p key={i} className={`text-slate-600 dark:text-slate-300 mb-2 ${trimmed === '' ? 'h-4' : ''}`}>
          {trimmed}
        </p>
      );
    });
  };

  const categorizeRecommendation = (recommendation: string) => {
    const lowerRec = recommendation.toLowerCase();
    
    if (lowerRec.includes('critical') || lowerRec.includes('dangerous') || lowerRec.includes('malicious') || lowerRec.includes('immediate')) {
      return { level: 'critical', icon: <AlertCircle size={16} />, color: 'red' };
    }
    if (lowerRec.includes('warning') || lowerRec.includes('caution') || lowerRec.includes('suspicious') || lowerRec.includes('careful')) {
      return { level: 'warning', icon: <AlertTriangle size={16} />, color: 'yellow' };
    }
    if (lowerRec.includes('security') || lowerRec.includes('protect') || lowerRec.includes('safe') || lowerRec.includes('lock')) {
      return { level: 'security', icon: <Lock size={16} />, color: 'blue' };
    }
    if (lowerRec.includes('monitor') || lowerRec.includes('watch') || lowerRec.includes('observe') || lowerRec.includes('track')) {
      return { level: 'monitoring', icon: <Eye size={16} />, color: 'purple' };
    }
    if (lowerRec.includes('action') || lowerRec.includes('immediate') || lowerRec.includes('quick') || lowerRec.includes('urgent')) {
      return { level: 'action', icon: <Zap size={16} />, color: 'orange' };
    }
    
    return { level: 'info', icon: <Info size={16} />, color: 'green' };
  };

  const getRecommendationStyle = (color: string) => {
    const styles = {
      red: 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400',
      yellow: 'border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
      blue: 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
      purple: 'border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400',
      orange: 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400',
      green: 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
    };
    return styles[color as keyof typeof styles] || styles.green;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-700 to-orange-600 dark:from-red-400 dark:to-orange-300">
          Security Scanner
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">
          Powered by VirusTotal + Gemini AI for comprehensive threat analysis
        </p>
      </div>

      {/* Scan Type Selector */}
      <div className="flex justify-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 flex shadow-lg">
          <button
            onClick={() => setScanType('file')}
            className={`px-6 py-2 rounded-xl font-medium transition-all ${
              scanType === 'file'
                ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileUp size={18} />
              File Scan
            </div>
          </button>
          <button
            onClick={() => setScanType('url')}
            className={`px-6 py-2 rounded-xl font-medium transition-all ${
              scanType === 'url'
                ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Globe size={18} />
              URL Scan
            </div>
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-lg">
        
        {/* File Upload */}
        {scanType === 'file' && (
          <div className="space-y-4">
            <div 
              onClick={() => !file && fileInputRef.current?.click()}
              className={`
                relative rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-8
                ${file 
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900' 
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-orange-400 cursor-pointer'
                }
              `}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange} 
                className="hidden" 
              />

              {!file ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mx-auto">
                    <FileUp size={32} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Upload File for Security Scan</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Drag & drop or click to browse</p>
                  </div>
                  <p className="text-xs text-slate-400">Max file size: 32MB</p>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-orange-600 dark:text-orange-400" />
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{file.name}</p>
                        <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button 
                      onClick={clearFile}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <X size={18} className="text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* URL Input */}
        {scanType === 'url' && (
          <div className="space-y-4">
            <div className="relative">
              <input
                ref={urlInputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter URL to scan (e.g., https://example.com)"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-4 pl-12 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-slate-900 dark:text-white placeholder-slate-400"
              />
              <Globe size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        )}

        {/* Scan Button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={handleScan}
            disabled={loading || (scanType === 'file' ? !file : !url.trim())}
            className={`
              px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2
              ${loading || (scanType === 'file' ? !file : !url.trim())
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg shadow-red-500/20'
              }
            `}
          >
            {loading ? <LoadingSpinner /> : <Shield size={20} />}
            {loading ? 'Scanning...' : 'Start Security Scan'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-fade-in-up">
          
          {/* Verdict Card */}
          <div className={`rounded-2xl border p-6 ${getVerdictColor(result.verdict)}`}>
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex items-center gap-3">
                {getVerdictIcon(result.verdict)}
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Security Verdict</h3>
                  <p className="text-2xl font-bold">{result.verdict}</p>
                </div>
              </div>
              <div className="text-center md:text-right">
                <div className="text-sm font-medium uppercase tracking-wider opacity-70">Safety Score</div>
                <div className={`text-3xl font-mono font-bold ${getScoreColor(result.score)}`}>
                  {result.score}/100
                </div>
              </div>
            </div>
          </div>

          {/* VirusTotal Stats */}
          {result.vtStats && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Shield size={20} className="text-orange-600 dark:text-orange-400" />
                VirusTotal Analysis
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-red-50 dark:bg-red-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{result.vtStats.malicious}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Malicious</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{result.vtStats.suspicious}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Suspicious</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{result.vtStats.harmless}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Harmless</div>
                </div>
                <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">{result.vtStats.undetected}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Undetected</div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Analysis */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-blue-600 dark:text-blue-400" />
              Detailed Analysis
            </h4>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {renderFormattedText(result.analysis)}
            </div>
          </div>

          {/* Enhanced Security Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                  <Target size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white">Security Recommendations</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Prioritized actions to enhance your security</p>
                </div>
              </div>
              
              <div className="grid gap-4">
                {result.recommendations.map((rec, idx) => {
                  const category = categorizeRecommendation(rec);
                  const styleClass = getRecommendationStyle(category.color);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`relative border rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${styleClass}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          category.color === 'red' ? 'bg-red-100 dark:bg-red-500/20' :
                          category.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-500/20' :
                          category.color === 'blue' ? 'bg-blue-100 dark:bg-blue-500/20' :
                          category.color === 'purple' ? 'bg-purple-100 dark:bg-purple-500/20' :
                          category.color === 'orange' ? 'bg-orange-100 dark:bg-orange-500/20' :
                          'bg-green-100 dark:bg-green-500/20'
                        }`}>
                          {category.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-md ${
                              category.color === 'red' ? 'bg-red-200 dark:bg-red-500/30 text-red-800 dark:text-red-300' :
                              category.color === 'yellow' ? 'bg-yellow-200 dark:bg-yellow-500/30 text-yellow-800 dark:text-yellow-300' :
                              category.color === 'blue' ? 'bg-blue-200 dark:bg-blue-500/30 text-blue-800 dark:text-blue-300' :
                              category.color === 'purple' ? 'bg-purple-200 dark:bg-purple-500/30 text-purple-800 dark:text-purple-300' :
                              category.color === 'orange' ? 'bg-orange-200 dark:bg-orange-500/30 text-orange-800 dark:text-orange-300' :
                              'bg-green-200 dark:bg-green-500/30 text-green-800 dark:text-green-300'
                            }`}>
                              {category.level}
                            </span>
                            {category.level === 'critical' && (
                              <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertCircle size={12} />
                                High Priority
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed">
                            {rec}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Summary Stats */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap gap-4 justify-center">
                  {(() => {
                    const categorized = result.recommendations.map(rec => categorizeRecommendation(rec));
                    const counts = categorized.reduce((acc, cat) => {
                      acc[cat.level] = (acc[cat.level] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);
                    
                    return Object.entries(counts).map(([level, count]) => {
                      const cat = categorized.find(c => c.level === level);
                      if (!cat) return null;
                      return (
                        <div key={level} className="flex items-center gap-2 text-sm">
                          <div className={`w-3 h-3 rounded-full ${
                            cat.color === 'red' ? 'bg-red-500' :
                            cat.color === 'yellow' ? 'bg-yellow-500' :
                            cat.color === 'blue' ? 'bg-blue-500' :
                            cat.color === 'purple' ? 'bg-purple-500' :
                            cat.color === 'orange' ? 'bg-orange-500' :
                            'bg-green-500'
                          }`}></div>
                          <span className="text-slate-600 dark:text-slate-400">
                            {count} {level}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* VirusTotal Link */}
          {result.permalink && (
            <div className="text-center">
              <a
                href={result.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <ExternalLink size={18} />
                View Full VirusTotal Report
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SecurityScanner;
