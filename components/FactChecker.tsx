import React, { useState } from 'react';
import { Search, CheckCircle, XCircle, HelpCircle, ExternalLink, FileText } from 'lucide-react';
import { checkFactWithGemini } from '../services/geminiService';
import { FactCheckResult, Verdict } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

const FactChecker: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FactCheckResult | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setResult(null);
    try {
      const data = await checkFactWithGemini(query);
      setResult(data);
    } catch (error) {
      alert("Error verifying fact. Please check your API configuration.");
    } finally {
      setLoading(false);
    }
  };

  const getVerdictBadge = (v: Verdict) => {
    switch (v) {
      case Verdict.TRUE: return <span className="flex items-center text-green-700 dark:text-green-400 gap-2"><CheckCircle size={20} /> Verified True</span>;
      case Verdict.FALSE: return <span className="flex items-center text-red-700 dark:text-red-400 gap-2"><XCircle size={20} /> Proven False</span>;
      default: return <span className="flex items-center text-yellow-700 dark:text-yellow-400 gap-2"><HelpCircle size={20} /> Uncertain / Complex</span>;
    }
  };

  // Helper to format structured text from Gemini
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      // Detect headers styled as **Header**
      if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 50) {
        const headerText = trimmed.replace(/\*\*/g, '');
        return (
          <h4 key={i} className="text-cyan-700 dark:text-cyan-400 font-bold mt-6 mb-2 text-md uppercase tracking-wide border-l-2 border-cyan-500 pl-3">
            {headerText}
          </h4>
        );
      }
      
      // Detect bolding inline
      const parts = line.split(/(\*\*.*?\*\*)/g);
      
      return (
        <div key={i} className={`min-h-[1em] text-slate-700 dark:text-slate-300 leading-relaxed ${trimmed === '' ? 'mb-2' : 'mb-1'}`}>
          {parts.map((part, j) => {
             if (part.startsWith('**') && part.endsWith('**')) {
                 return <span key={j} className="text-slate-900 dark:text-white font-semibold">{part.replace(/\*\*/g, '')}</span>
             }
             return <span key={j}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-600 dark:from-blue-400 dark:to-cyan-300">
          Fact Verification Engine
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">
          Powered by Gemini & Google Search Grounding to verify claims in real-time.
        </p>
      </div>

      <form onSubmit={handleVerify} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a claim, rumor, or news headline..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-6 pr-16 text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-xl dark:shadow-none shadow-blue-900/5"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 top-2 bottom-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-6 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-blue-500/20"
        >
          {loading ? <LoadingSpinner /> : <Search size={20} />}
        </button>
      </form>

      {result && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.05)] dark:shadow-2xl animate-fade-in-up transition-colors">
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 border-b border-slate-100 dark:border-slate-800 pb-6 gap-4 md:gap-0">
            <div>
              <h3 className="text-lg font-semibold text-slate-500 dark:text-slate-300 mb-1 uppercase tracking-wide text-xs">Verdict Analysis</h3>
              <div className="text-2xl font-bold">{getVerdictBadge(result.verdict)}</div>
            </div>
            {result.verdict === Verdict.TRUE && (
              <div className="bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border border-green-100 dark:border-transparent">
                Confirmed
              </div>
            )}
            {result.verdict === Verdict.FALSE && (
              <div className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border border-red-100 dark:border-transparent">
                Debunked
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="bg-slate-50 dark:bg-slate-950/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-2 mb-4">
                 <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                 <h4 className="font-bold text-slate-800 dark:text-slate-200">Detailed Report</h4>
              </div>
              <div className="pl-1 text-sm md:text-base space-y-2">
                {renderFormattedText(result.explanation)}
              </div>
            </div>

            {result.sources.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
                  <ExternalLink size={14} /> Referenced Sources
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.sources.map((source, idx) => (
                    <a 
                      key={idx} 
                      href={source.uri} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex flex-col p-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 group shadow-sm hover:shadow-md"
                    >
                      <span className="text-cyan-700 dark:text-cyan-400 text-sm font-bold truncate group-hover:underline">
                        {source.title || new URL(source.uri || '').hostname}
                      </span>
                      <span className="text-slate-400 text-xs truncate mt-1">
                        {source.uri}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FactChecker;