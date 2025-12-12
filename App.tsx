import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import FactChecker from './components/FactChecker';
import ScamDetector from './components/ScamDetector';
import DeepfakeDetector from './components/DeepfakeDetector';
import VoiceAssistant from './components/VoiceAssistant';
import LandingPage from './components/LandingPage';
import { AppMode } from './types';

const App: React.FC = () => {
  const [showLanding, setShowLanding] = useState(true);
  const [mode, setMode] = useState<AppMode>(AppMode.FACT_CHECK);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Initialize theme from system or default to dark
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} theme={theme} toggleTheme={toggleTheme} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-cyan-500/30 transition-colors duration-300">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
         {/* Ambient Background Effects - Tuned for Light/Dark */}
         <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/20 dark:bg-blue-900/20 rounded-full blur-[128px] mix-blend-multiply dark:mix-blend-screen opacity-50 dark:opacity-100"></div>
         <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-400/20 dark:bg-cyan-900/10 rounded-full blur-[128px] mix-blend-multiply dark:mix-blend-screen opacity-50 dark:opacity-100"></div>
      </div>

      <div className="relative z-10 flex flex-col h-screen">
        <Navbar currentMode={mode} setMode={setMode} theme={theme} toggleTheme={toggleTheme} />
        
        <main className="flex-grow overflow-auto py-4 md:py-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
            {mode === AppMode.FACT_CHECK && (
              <div className="animate-fade-in">
                <FactChecker />
              </div>
            )}
            {mode === AppMode.SCAM_DETECTOR && (
               <div className="animate-fade-in h-full">
                <ScamDetector />
              </div>
            )}
            {mode === AppMode.DEEPFAKE_DETECTOR && (
               <div className="animate-fade-in h-full">
                <DeepfakeDetector />
              </div>
            )}
            {mode === AppMode.VOICE_ASSISTANT && (
               <div className="animate-fade-in h-full">
                <VoiceAssistant />
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;