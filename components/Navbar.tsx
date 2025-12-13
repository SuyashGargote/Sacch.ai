import React from 'react';
import { ShieldCheck, Search, FileWarning, Video, Mic, Sun, Moon, Shield } from 'lucide-react';
import { AppMode } from '../types';

interface NavbarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentMode, setMode, theme, toggleTheme }) => {
  const navItems = [
    { mode: AppMode.FACT_CHECK, label: 'Fact Check', icon: Search, color: 'text-cyan-600 dark:text-cyan-400' },
    { mode: AppMode.SCAM_DETECTOR, label: 'Scam & Fraud', icon: FileWarning, color: 'text-yellow-600 dark:text-yellow-400' },
    { mode: AppMode.DEEPFAKE_DETECTOR, label: 'Deepfake', icon: Video, color: 'text-purple-600 dark:text-purple-400' }, 
    { mode: AppMode.SECURITY_SCANNER, label: 'Security Scan', icon: Shield, color: 'text-red-600 dark:text-red-400' },
    { mode: AppMode.VOICE_ASSISTANT, label: 'Live Assistant', icon: Mic, color: 'text-pink-600 dark:text-pink-400' },
  ];

  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center h-auto md:h-20 py-3 md:py-0 gap-3 md:gap-0">
          
          {/* Logo Section */}
          <div className="flex items-center justify-between w-full md:w-auto">
             <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-cyan-600 to-blue-700 p-2 md:p-2.5 rounded-xl shadow-lg shadow-cyan-900/20 shrink-0">
                  <ShieldCheck className="text-white w-6 h-6 md:w-7 md:h-7" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white transition-colors">Sacch<span className="text-cyan-600 dark:text-cyan-500">.ai</span></h1>
                  <p className="text-[10px] md:text-xs text-slate-500 font-medium tracking-wide hidden sm:block">INTELLIGENT THREAT DETECTION</p>
                </div>
             </div>
             
             {/* Mobile Theme Toggle (visible only on small screens) */}
             <button 
                onClick={toggleTheme}
                className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
             >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>
          </div>

          {/* Navigation Items & Desktop Toggle */}
          <div className="flex w-full md:w-auto items-center justify-start md:justify-end gap-2 md:gap-4">
            <div className="flex space-x-1 overflow-x-auto no-scrollbar pb-1 md:pb-0 mask-image-fade flex-1 md:flex-none">
              {navItems.map((item) => {
                const isActive = currentMode === item.mode;
                return (
                  <button
                    key={item.mode}
                    onClick={() => setMode(item.mode)}
                    className={`
                      relative flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap flex-shrink-0
                      ${isActive 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'}
                    `}
                  >
                    <item.icon size={18} className={isActive ? item.color : 'text-slate-400 dark:text-slate-500'} />
                    <span className={`${isActive ? 'inline' : 'hidden md:inline'}`}>{item.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Desktop Theme Toggle */}
            <button 
                onClick={toggleTheme}
                className="hidden md:flex items-center justify-center p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                aria-label="Toggle Theme"
             >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>
          </div>
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </nav>
  );
};

export default Navbar;