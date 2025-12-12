import React, { useState, useRef } from 'react';
import { Mail, Link as LinkIcon, FileSearch, ShieldCheck, ShieldAlert, AlertOctagon, Info, ArrowRight, Check, Upload, File as FileIcon, X, ChevronRight, Activity, AlertTriangle } from 'lucide-react';
import { analyzeScamContent } from '../services/geminiService';
import { ScamAnalysisResult, Verdict } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

const ScamDetector: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'EMAIL' | 'URL' | 'FILE'>('EMAIL');
  const [inputText, setInputText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScamAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const handleAnalyze = async () => {
    if (activeTab === 'EMAIL' || activeTab === 'URL') {
       if (!inputText.trim()) return;
    } else if (activeTab === 'FILE') {
       if (!file) return;
    }

    setLoading(true);
    setResult(null);

    try {
      let contentToAnalyze = inputText;
      
      // If File tab, we hash the file and send the hash
      if (activeTab === 'FILE' && file) {
        contentToAnalyze = await calculateSHA256(file);
      }

      const data = await analyzeScamContent(contentToAnalyze, activeTab);
      setResult(data);
    } catch (error) {
      alert("Analysis failed. Ensure API keys are configured and try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getVerdictStyles = (verdict: Verdict) => {
    switch(verdict) {
        case Verdict.SAFE: 
            return { 
                color: 'text-emerald-700 dark:text-emerald-400', 
                bg: 'bg-emerald-50 dark:bg-emerald-950/30', 
                border: 'border-emerald-200 dark:border-emerald-500/30', 
                icon: ShieldCheck,
                gradient: 'from-emerald-500 to-teal-600',
                badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300',
                label: 'Safe to Proceed'
            };
        case Verdict.SUSPICIOUS: 
            return { 
                color: 'text-amber-700 dark:text-amber-400', 
                bg: 'bg-amber-50 dark:bg-amber-950/30', 
                border: 'border-amber-200 dark:border-amber-500/30', 
                icon: ShieldAlert,
                gradient: 'from-amber-500 to-orange-600',
                badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300',
                label: 'Caution Advised'
            };
        case Verdict.MALICIOUS: 
            return { 
                color: 'text-rose-700 dark:text-rose-400', 
                bg: 'bg-rose-50 dark:bg-rose-950/30', 
                border: 'border-rose-200 dark:border-rose-500/30', 
                icon: AlertOctagon,
                gradient: 'from-rose-500 to-red-600',
                badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300',
                label: 'High Threat Detected'
            };
        default: 
            return { 
                color: 'text-slate-600 dark:text-slate-400', 
                bg: 'bg-slate-50 dark:bg-slate-800', 
                border: 'border-slate-200 dark:border-slate-700', 
                icon: Info,
                gradient: 'from-slate-500 to-slate-600',
                badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
                label: 'Analysis Complete'
            };
    }
  };

  const ScoreGauge = ({ score }: { score: number }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    let colorClass = 'text-rose-500 dark:text-rose-400';
    if (score >= 80) colorClass = 'text-emerald-500 dark:text-emerald-400';
    else if (score >= 50) colorClass = 'text-amber-500 dark:text-amber-400';

    return (
        <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90 drop-shadow-lg">
                <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    className="text-slate-200 dark:text-slate-700"
                />
                <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className={`${colorClass} transition-all duration-1000 ease-out`}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-lg font-bold ${colorClass}`}>{score}</span>
            </div>
        </div>
    );
  };

  const renderAnalysisText = (text: string) => {
    return text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        
        // H3 Headers (###)
        if (trimmed.startsWith('### ')) {
             return <h3 key={i} className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-6 mb-3 flex items-center gap-2"><div className="w-1 h-6 bg-cyan-500 rounded-full"></div>{trimmed.substring(4)}</h3>;
        }

        // H4 Headers (####) or legacy **Header**
        if (trimmed.startsWith('#### ') || (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 60)) {
            const content = trimmed.startsWith('#### ') ? trimmed.substring(5) : trimmed.replace(/\*\*/g, '');
            return <h4 key={i} className="font-bold text-slate-700 dark:text-slate-300 mt-4 mb-2 uppercase tracking-wider text-xs border-l-2 border-slate-300 dark:border-slate-700 pl-3">{content}</h4>;
        }
        
        // Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
                <div key={i} className="flex items-start gap-3 mb-2 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0"></div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{trimmed.substring(2)}</p>
                </div>
            )
        }

        // Standard Paragraphs with bolding
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
            <p key={i} className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-2">
                {parts.map((part, j) => {
                     if (part.startsWith('**') && part.endsWith('**')) {
                         return <strong key={j} className="text-slate-800 dark:text-slate-200 font-semibold">{part.replace(/\*\*/g, '')}</strong>
                     }
                     return <span key={j}>{part}</span>;
                })}
            </p>
        );
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-10 text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Scam & Fraud Intelligence</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
          Detect phishing, malware, and fraud using Gemini AI + VirusTotal threat intelligence.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
        
        {/* Left Column: Input Section */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Tab Switcher */}
          <div className="bg-white dark:bg-slate-900/80 p-1.5 rounded-2xl flex shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800/50 backdrop-blur-sm">
            <button
              onClick={() => { setActiveTab('EMAIL'); setResult(null); setInputText(''); setFile(null); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold transition-all duration-300 text-sm md:text-base ${
                activeTab === 'EMAIL' 
                  ? 'bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Mail size={16} /> 
              <span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={() => { setActiveTab('URL'); setResult(null); setInputText(''); setFile(null); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold transition-all duration-300 text-sm md:text-base ${
                activeTab === 'URL' 
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <LinkIcon size={16} /> 
              <span className="hidden sm:inline">URL</span>
            </button>
            <button
              onClick={() => { setActiveTab('FILE'); setResult(null); setInputText(''); setFile(null); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold transition-all duration-300 text-sm md:text-base ${
                activeTab === 'FILE' 
                  ? 'bg-slate-100 dark:bg-slate-800 text-rose-700 dark:text-rose-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <FileSearch size={16} /> 
              <span className="hidden sm:inline">File</span>
            </button>
          </div>

          {/* Input Area */}
          <div className="relative group">
            <div className={`absolute -inset-0.5 rounded-3xl opacity-20 group-hover:opacity-30 transition duration-500 blur 
              ${activeTab === 'EMAIL' ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 
                activeTab === 'URL' ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 
                'bg-gradient-to-r from-rose-500 to-orange-500'}`}></div>
            
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-1 border border-slate-100 dark:border-slate-800 shadow-2xl h-80 flex flex-col">
              {activeTab === 'FILE' ? (
                // File Upload UI
                <div 
                  onClick={() => !file && fileInputRef.current?.click()}
                  className={`flex-1 rounded-2xl border-2 border-dashed m-1 flex flex-col items-center justify-center transition-all
                    ${file 
                      ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900' 
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-rose-400 cursor-pointer'}
                  `}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  
                  {!file ? (
                    <div className="text-center p-6 space-y-3">
                       <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center mx-auto shadow-sm border border-slate-100 dark:border-transparent">
                         <Upload size={28} className="text-rose-500 dark:text-rose-400" />
                       </div>
                       <p className="text-slate-700 dark:text-slate-300 font-medium">Upload suspicious file</p>
                       <p className="text-xs text-slate-500 max-w-xs mx-auto">
                         We will verify the file hash against the VirusTotal database.
                       </p>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex flex-col items-center justify-center p-6 space-y-4">
                       <FileIcon size={48} className="text-slate-400" />
                       <div className="text-center">
                          <p className="text-slate-900 dark:text-white font-medium break-all max-w-[200px] truncate">{file.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                       </div>
                       <button 
                         onClick={clearFile}
                         className="absolute top-2 right-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-rose-500 hover:text-white text-slate-500 dark:text-slate-400 transition-colors"
                       >
                         <X size={16} />
                       </button>
                    </div>
                  )}
                </div>
              ) : (
                // Text/URL Input UI
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={activeTab === 'EMAIL' 
                    ? "Paste the email subject and body here..." 
                    : "Enter the suspicious website URL (e.g., http://example.com/login)..."
                  }
                  className="w-full h-full bg-transparent rounded-2xl p-6 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-0 resize-none font-mono text-sm leading-relaxed"
                />
              )}
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading || (activeTab === 'FILE' ? !file : !inputText)}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 ${
                activeTab === 'EMAIL' 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-900/20' 
                : activeTab === 'URL'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-900/20'
                : 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 shadow-rose-900/20'
            }`}
          >
            {loading ? <LoadingSpinner /> : (
              <>
                <ShieldCheck size={20} />
                {activeTab === 'FILE' ? 'Scan File Hash' : 'Scan for Threats'}
              </>
            )}
          </button>
        </div>

        {/* Right Column: Results or Info */}
        <div className="lg:col-span-7 h-full flex flex-col">
          {!result ? (
             // Empty State / Education
            <div className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 h-full min-h-[300px] flex flex-col justify-center text-slate-500 dark:text-slate-400 space-y-8">
               <div className="space-y-4">
                 <h3 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                   <Info size={20} className="text-cyan-600 dark:text-cyan-400" />
                   Detection capabilities
                 </h3>
                 <p className="text-sm leading-relaxed">
                   Our AI engine checks against known patterns of social engineering, malicious domains, and malware signatures.
                 </p>
               </div>
               
               <div className="space-y-4">
                 <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Analysis Sources</h4>
                 <ul className="space-y-3">
                   <li className="flex items-start gap-3 text-sm">
                     <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded mt-0.5"><AlertOctagon size={12} className="text-rose-500 dark:text-rose-400" /></div>
                     <span>Google Search Grounding (Real-time web check)</span>
                   </li>
                   <li className="flex items-start gap-3 text-sm">
                     <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded mt-0.5"><AlertOctagon size={12} className="text-indigo-500 dark:text-indigo-400" /></div>
                     <span>VirusTotal Database (Malware & URL reputation)</span>
                   </li>
                   <li className="flex items-start gap-3 text-sm">
                     <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded mt-0.5"><AlertOctagon size={12} className="text-cyan-500 dark:text-cyan-400" /></div>
                     <span>Gemini 2.5 AI (Context & Pattern Analysis)</span>
                   </li>
                 </ul>
               </div>
            </div>
          ) : (
            // Result State
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-[0_20px_40px_-5px_rgba(0,0,0,0.05)] dark:shadow-2xl animate-fade-in flex flex-col h-full min-h-[500px]">
               
               {/* New Verdict Header */}
               {(() => {
                 const style = getVerdictStyles(result.verdict);
                 const Icon = style.icon;
                 return (
                   <div className={`relative p-6 md:p-8 border-b ${style.border} ${style.bg} overflow-hidden`}>
                      {/* Background Accents */}
                      <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${style.gradient} opacity-5 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2`}></div>
                      
                      <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                          <div className="flex items-start gap-6 w-full md:w-auto">
                              <div className={`p-4 rounded-2xl bg-white dark:bg-slate-950 border ${style.border} shadow-lg hidden md:flex items-center justify-center shrink-0`}>
                                 <Icon size={40} className={style.color} />
                              </div>
                              <div className="flex-1">
                                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 ${style.badge}`}>
                                     {style.label}
                                  </div>
                                  <h3 className={`text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight`}>
                                     {result.verdict.charAt(0) + result.verdict.slice(1).toLowerCase()}
                                  </h3>
                                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                      AI Confidence Level: High
                                  </p>
                              </div>
                          </div>
                          
                          {/* Score Gauge */}
                          <div className="flex items-center gap-4 bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-white/50 dark:border-white/5 backdrop-blur-sm">
                              <div className="text-right hidden md:block">
                                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Safety Score</div>
                                  <div className="text-xs text-slate-400">0 - 100 Scale</div>
                              </div>
                              <ScoreGauge score={result.score} />
                          </div>
                      </div>
                   </div>
                 );
               })()}

               {/* Analysis Content */}
               <div className="p-6 md:p-8 space-y-8 flex-grow overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-950/30">
                  
                  {/* VirusTotal Stats Block - VISIBLE IF AVAILABLE */}
                  {result.vtStats && (
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="text-center p-2">
                           <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{result.vtStats.malicious}</div>
                           <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">Malicious</div>
                        </div>
                        <div className="text-center p-2 border-l border-slate-100 dark:border-slate-800">
                           <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{result.vtStats.suspicious}</div>
                           <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">Suspicious</div>
                        </div>
                        <div className="text-center p-2 border-l border-slate-100 dark:border-slate-800">
                           <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{result.vtStats.harmless}</div>
                           <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">Harmless</div>
                        </div>
                         <div className="text-center p-2 border-l border-slate-100 dark:border-slate-800">
                           <div className="text-2xl font-bold text-slate-400">{result.vtStats.undetected}</div>
                           <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">Undetected</div>
                        </div>
                     </div>
                  )}

                  {/* Analysis Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                         <Activity size={18} />
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Threat Analysis</h4>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {renderAnalysisText(result.analysis)}
                    </div>
                  </div>

                  {/* Recommendations */}
                  {result.recommendations && result.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                          <ChevronRight size={18} className="text-cyan-500" />
                          Recommended Actions
                      </h4>
                      <div className="grid gap-3">
                        {result.recommendations.map((rec, i) => (
                          <div key={i} className="group flex items-start gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/30 hover:shadow-md transition-all">
                            <div className={`mt-0.5 p-1 rounded-full shrink-0 ${result.verdict === Verdict.SAFE ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                                {result.verdict === Verdict.SAFE ? <Check size={14} /> : <AlertTriangle size={14} />}
                            </div>
                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScamDetector;