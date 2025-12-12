import React, { useState, useRef } from 'react';
import { Upload, Video, Mic, Image as ImageIcon, Eye, Activity, AlertTriangle, CheckCircle, FileUp, X } from 'lucide-react';
import { analyzeDeepfakeMedia } from '../services/geminiService';
import { DeepfakeResult, Verdict } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

const DeepfakeDetector: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeepfakeResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert("File too large. Max 10MB for browser-based analysis.");
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const base64Data = await convertToBase64(file);
      const data = await analyzeDeepfakeMedia(base64Data, file.type);
      setResult(data);
    } catch (error) {
      alert("Analysis failed. Please try a different file.");
    } finally {
      setLoading(false);
    }
  };

  const getVerdictColor = (v: Verdict) => {
    if (v === Verdict.LIKELY_FAKE) return 'text-rose-600 dark:text-rose-500 from-rose-100 to-rose-50 dark:from-rose-500/20 dark:to-rose-500/5 border-rose-200 dark:border-rose-500/30';
    if (v === Verdict.LIKELY_REAL) return 'text-emerald-600 dark:text-emerald-500 from-emerald-100 to-emerald-50 dark:from-emerald-500/20 dark:to-emerald-500/5 border-emerald-200 dark:border-emerald-500/30';
    return 'text-amber-600 dark:text-amber-500 from-amber-100 to-amber-50 dark:from-amber-500/20 dark:to-amber-500/5 border-amber-200 dark:border-amber-500/30';
  };

  const getVerdictIcon = (v: Verdict) => {
     if (v === Verdict.LIKELY_FAKE) return <AlertTriangle size={32} />;
     if (v === Verdict.LIKELY_REAL) return <CheckCircle size={32} />;
     return <Activity size={32} />;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      
      {/* Header */}
      <div className="text-center space-y-3 mb-4 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Deepfake & Synthetic Media Forensics</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
          Upload images, audio, or video to analyze for AI-generated artifacts, inconsistencies, and manipulation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:h-[calc(100vh-16rem)] h-auto min-h-[600px]">
        
        {/* Left Panel: Upload & Preview */}
        <div className="lg:col-span-5 flex flex-col space-y-4 h-[500px] lg:h-full">
          <div 
            onClick={() => !file && fileInputRef.current?.click()}
            className={`
              relative flex-1 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden group
              ${file 
                ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900' 
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-cyan-400 cursor-pointer shadow-sm'
              }
            `}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange} 
              accept="video/*,audio/*,image/*" 
              className="hidden" 
            />

            {!file ? (
              <div className="text-center p-8 space-y-4">
                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300 border border-slate-200 dark:border-slate-700">
                  <FileUp size={32} className="text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Upload Media</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Drag & drop or click to browse</p>
                </div>
                <div className="flex gap-4 justify-center text-xs text-slate-400 dark:text-slate-500 font-mono mt-4">
                  <span className="flex items-center gap-1"><ImageIcon size={12}/> JPG/PNG</span>
                  <span className="flex items-center gap-1"><Video size={12}/> MP4</span>
                  <span className="flex items-center gap-1"><Mic size={12}/> MP3/WAV</span>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center bg-black rounded-3xl">
                {preview && (
                  <>
                    {file.type.startsWith('video') ? (
                       <video src={preview} controls className="max-w-full max-h-full object-contain" />
                    ) : file.type.startsWith('image') ? (
                       <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                       <div className="text-center space-y-4 p-8">
                          <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mx-auto animate-pulse">
                            <Mic size={48} className="text-pink-500" />
                          </div>
                          <p className="text-slate-400 font-mono">{file.name}</p>
                          <audio src={preview} controls className="w-64" />
                       </div>
                    )}
                  </>
                )}
                
                {/* Remove File Button */}
                <button 
                  onClick={clearFile}
                  className="absolute top-4 right-4 bg-black/60 hover:bg-red-500/80 text-white p-2 rounded-full backdrop-blur-sm transition-colors z-10"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${file ? 'bg-cyan-100 dark:bg-cyan-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {file ? (
                  file.type.startsWith('image') ? <ImageIcon size={20} className="text-cyan-600 dark:text-cyan-400" /> :
                  file.type.startsWith('video') ? <Video size={20} className="text-purple-600 dark:text-purple-400" /> :
                  <Mic size={20} className="text-pink-600 dark:text-pink-400" />
                ) : <Activity size={20} className="text-slate-400 dark:text-slate-500" />}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{file ? 'Ready to analyze' : 'No file selected'}</p>
                <p className="text-xs text-slate-500">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Select media to start'}</p>
              </div>
            </div>
            
            <button
              onClick={handleAnalyze}
              disabled={!file || loading}
              className={`
                px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2
                ${!file || loading 
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/40'
                }
              `}
            >
              {loading ? <LoadingSpinner /> : (
                <>
                  <Activity size={16} />
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-7 h-auto lg:h-full">
          {!result ? (
            <div className="h-full min-h-[300px] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex flex-col items-center justify-center text-center p-8 space-y-6 shadow-sm">
               <div className="relative">
                 <div className="absolute inset-0 bg-cyan-400/20 blur-3xl rounded-full opacity-20"></div>
                 <Activity size={64} className="text-slate-300 dark:text-slate-700 relative z-10" />
               </div>
               <div className="max-w-md space-y-2">
                 <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-300">Awaiting Analysis</h3>
                 <p className="text-slate-500">
                   Our multi-modal AI model will inspect visual inconsistencies, audio frequency anomalies, and unnatural patterns.
                 </p>
               </div>
               
               {loading && (
                 <div className="w-full max-w-xs space-y-3 mt-8">
                   <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-500 animate-progress"></div>
                   </div>
                   <p className="text-xs text-cyan-600 dark:text-cyan-400 font-mono animate-pulse">Scanning artifacts...</p>
                 </div>
               )}
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-4">
              {/* Verdict Card */}
              <div className={`relative overflow-hidden rounded-3xl border p-6 lg:p-8 bg-gradient-to-br ${getVerdictColor(result.verdict)} shadow-lg`}>
                 <div className="relative z-10 flex flex-wrap justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-2 opacity-80">
                         {getVerdictIcon(result.verdict)}
                         Analysis Verdict
                      </div>
                      <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {result.verdict.replace('_', ' ')}
                      </h2>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="text-sm font-medium uppercase tracking-widest opacity-70 mb-1">Confidence</div>
                      <div className="text-4xl font-mono font-bold">{result.confidence}%</div>
                    </div>
                 </div>
              </div>

              {/* Details Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                 
                 {/* Visual Analysis */}
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 overflow-y-auto custom-scrollbar min-h-[200px] shadow-sm">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4 sticky top-0 bg-white dark:bg-slate-900 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <Eye size={18} className="text-indigo-600 dark:text-indigo-400" />
                      Visual Inspection
                    </h4>
                    {result.visualArtifacts.length > 0 ? (
                      <ul className="space-y-3">
                        {result.visualArtifacts.map((art, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-100 dark:border-transparent">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                            {art}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No significant visual anomalies detected.</p>
                    )}
                 </div>

                 {/* Audio Analysis */}
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 overflow-y-auto custom-scrollbar min-h-[200px] shadow-sm">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4 sticky top-0 bg-white dark:bg-slate-900 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <Mic size={18} className="text-pink-600 dark:text-pink-400" />
                      Audio Spectrum
                    </h4>
                    {result.audioArtifacts.length > 0 ? (
                      <ul className="space-y-3">
                        {result.audioArtifacts.map((art, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-100 dark:border-transparent">
                            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5 shrink-0"></div>
                            {art}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No significant audio anomalies detected.</p>
                    )}
                 </div>
              </div>

              {/* Technical Summary */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                 <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Technical Summary</h4>
                 <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                   {result.technicalDetails}
                 </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeepfakeDetector;