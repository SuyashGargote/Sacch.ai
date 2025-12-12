import React, { useEffect, useRef, useState } from 'react';
import { Search, FileWarning, Video, ArrowRight, ShieldCheck, Terminal, Cpu, Lock, Globe, Activity, Database, AlertCircle, Check, Code, Layers, Sun, Moon } from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

// --- Particle System Logic ---

class Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  ease: number;
  friction: number;
  dx: number;
  dy: number;
  distance: number;
  force: number;
  angle: number;
  type: 'TEXT' | 'STAR';
  alpha: number;

  constructor(x: number, y: number, color: string, width: number, height: number, type: 'TEXT' | 'STAR') {
    this.type = type;
    this.color = color;
    this.alpha = Math.random() * 0.5 + 0.5; // Initial random opacity
    
    if (type === 'STAR') {
        // Background stars start randomly
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.originX = this.x;
        this.originY = this.y;
        this.size = Math.random() * 2; // Slightly varied star sizes
        // Constant low velocity for drift
        this.vx = (Math.random() - 0.5) * 0.2; 
        this.vy = (Math.random() - 0.5) * 0.2;
        this.ease = 0;
        this.friction = 1; 
    } else {
        // Text particles target specific pixels
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.originX = x; 
        this.originY = y;
        this.size = Math.random() * 1.1 + 0.2; // Smaller text stars for finer detail
        this.vx = 0;
        this.vy = 0;
        // Floaty physics settings - Smoother animation
        this.ease = 0.02; 
        this.friction = 0.95; 
    }

    this.dx = 0;
    this.dy = 0;
    this.distance = 0;
    this.force = 0;
    this.angle = 0;
  }

  update(ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number, width: number, height: number) {
    if (this.type === 'STAR') {
        // Star Drift Logic
        this.x += this.vx;
        this.y += this.vy;

        // Wrap around screen
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;

    } else {
        // Text Particle Physics with Mouse Interaction
        this.dx = mouseX - this.x;
        this.dy = mouseY - this.y;
        this.distance = this.dx * this.dx + this.dy * this.dy;
        
        // Reduced interaction radius for smaller cursor (radius squared)
        // 2500 ~= 50px radius
        const interactionRadius = 2500; 
        
        if (this.distance < interactionRadius) {
           // Smoother attraction force calculation
           // Calculate normalized distance (0 to 1)
           const dist = Math.sqrt(this.distance);
           const radius = Math.sqrt(interactionRadius);
           
           // Linear force: Stronger at center, zero at edge. No infinity spikes.
           const normForce = (radius - dist) / radius;
           const attractionStrength = 2; // Gentle pull

           this.angle = Math.atan2(this.dy, this.dx);
           this.vx += normForce * attractionStrength * Math.cos(this.angle);
           this.vy += normForce * attractionStrength * Math.sin(this.angle);
        }

        this.x += (this.vx *= this.friction) + (this.originX - this.x) * this.ease;
        this.y += (this.vy *= this.friction) + (this.originY - this.y) * this.ease;
    }

    // Twinkle Logic for ALL particles
    if (Math.random() > 0.95) {
        this.alpha = Math.random() * 0.7 + 0.3;
    }

    ctx.globalAlpha = this.alpha;
    this.draw(ctx);
    ctx.globalAlpha = 1; // Reset alpha
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter, theme, toggleTheme }) => {
  const [bootPhase, setBootPhase] = useState<'BOOT' | 'ACCESS' | 'MAIN'>('BOOT');
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // --- Boot Sequence Logic ---
  useEffect(() => {
    const bootLogs = [
      "INITIALIZING KERNEL...",
      "LOADING SACCH.AI MODULES...",
      "CONNECTING TO GLOBAL THREAT DB...",
      "VERIFYING INTEGRITY...",
      "CALIBRATING SENSORS...",
      "ESTABLISHING SECURE HANDSHAKE...",
      "SYSTEM OPTIMAL."
    ];

    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < bootLogs.length) {
        setLogs(prev => [...prev, `> ${bootLogs[logIndex]}`]);
        logIndex++;
      } else {
        clearInterval(logInterval);
      }
    }, 400);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
            clearInterval(progressInterval);
            setTimeout(() => setBootPhase('ACCESS'), 500);
            setTimeout(() => setBootPhase('MAIN'), 1800);
            return 100;
        }
        return prev + (Math.random() * 5);
      });
    }, 150);

    return () => {
        clearInterval(logInterval);
        clearInterval(progressInterval);
    };
  }, []);

  // --- Space & Text Particle Animation ---
  useEffect(() => {
    if (bootPhase !== 'MAIN') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrameId: number;
    
    let particles: Particle[] = [];
    let mouseX = -1000;
    let mouseY = -1000;
    
    // Theme colors - darker blue-gray for light mode text particles for sharpness
    // Use #020617 (slate-950) in light mode for max contrast, #ffffff in dark mode.
    const particleColor = theme === 'dark' ? '#ffffff' : '#020617'; 
    // Clean slate-50 background for light mode
    const bgColor = theme === 'dark' ? '#020617' : '#f8fafc';

    const initParticles = () => {
      particles = [];
      
      // 1. Create Background Stars
      const starCount = Math.floor((width * height) / 15000); 
      for (let i = 0; i < starCount; i++) {
          particles.push(new Particle(0, 0, particleColor, width, height, 'STAR'));
      }

      // 2. Draw Text to get positions
      const fontSize = Math.min(100, width / 6); 
      ctx.font = `900 ${fontSize}px "Inter", sans-serif`;
      ctx.fillStyle = 'white'; // Always draw white on temp canvas for sampling
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sacch.ai', width / 2, height / 2);

      // 3. Scan Data
      const textData = ctx.getImageData(0, 0, width, height);
      ctx.clearRect(0, 0, width, height); 

      const gap = 2; // Particle density for text (lower number = more particles)
      for (let y = 0; y < height; y += gap) {
          for (let x = 0; x < width; x += gap) {
             const index = (y * width + x) * 4;
             if (textData.data[index + 3] > 128) {
                 particles.push(new Particle(x, y, particleColor, width, height, 'TEXT'));
             }
          }
      }
    };

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };
    
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);

    resize();

    const animate = () => {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
        particles.forEach(p => p.update(ctx, mouseX, mouseY, width, height));
        animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', handleMouseMove);
        cancelAnimationFrame(animationFrameId);
    };
  }, [bootPhase, theme]); // Re-run when theme changes


  if (bootPhase === 'BOOT') {
    return (
        <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md space-y-6">
                <div className="flex justify-between items-end border-b border-white/50 pb-2">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Terminal size={20} /> SYSTEM BOOT
                    </h2>
                    <span className="text-xs animate-pulse">{Math.min(100, Math.floor(progress))}%</span>
                </div>
                <div className="h-64 overflow-hidden border-l-2 border-white/30 pl-4 space-y-1 relative">
                    {logs.map((log, i) => (
                        <div key={i} className="text-sm opacity-80 animate-fade-in-fast">{log}</div>
                    ))}
                    <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-black to-transparent"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-1 w-full bg-white/30 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-100 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fadeInFast { from { opacity: 0; transform: translateY(5px); } to { opacity: 0.8; transform: translateY(0); } }
                .animate-fade-in-fast { animation: fadeInFast 0.1s ease-out forwards; }
            `}</style>
        </div>
    );
  }

  if (bootPhase === 'ACCESS') {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
            <div className="z-10 text-center space-y-4 animate-scale-up">
                <div className="inline-flex p-4 rounded-full border-2 border-white bg-white/20 shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                    <Lock size={48} className="text-white" />
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-widest uppercase">
                    Access Granted
                </h1>
            </div>
            <style>{`
                @keyframes scaleUp { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .animate-scale-up { animation: scaleUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
            `}</style>
        </div>
      )
  }

  return (
    <div className="relative min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-white selection:bg-cyan-500/30 overflow-x-hidden transition-colors duration-300">
        
        {/* Theme Toggle Overlay for Landing */}
        <div className="absolute top-6 right-6 z-50">
             <button 
                onClick={toggleTheme}
                className="p-3 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-slate-200 dark:border-white/20 text-slate-700 dark:text-white hover:bg-white/80 dark:hover:bg-white/20 transition-all shadow-sm"
             >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>
        </div>

        <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
            <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-[#f8fafc] dark:bg-slate-950" />
            <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,#f1f5f9_90%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,#020617_90%)] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-[linear-gradient(to_bottom,transparent_0%,#e2e8f0_100%)] dark:bg-[linear-gradient(to_bottom,transparent_0%,#0f172a_100%)] z-0 pointer-events-none"></div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 text-center space-y-20 md:space-y-32 pointer-events-none">
                <div className="h-16 md:h-32"></div>
                <div className="pt-4 md:pt-8 animate-fade-in-up delay-300 pointer-events-auto">
                     <p className="text-lg md:text-2xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-light leading-relaxed drop-shadow-sm dark:drop-shadow-lg mb-8">
                        The definitive AI layer for truth in a synthetic world.
                    </p>
                    <button 
                        onClick={onEnter}
                        className="group relative inline-flex items-center justify-center px-8 py-4 md:px-12 md:py-6 font-bold text-white transition-all duration-200 bg-slate-900 dark:bg-white/10 hover:bg-slate-800 dark:hover:bg-white/20 rounded-full focus:outline-none ring-offset-2 focus:ring-2 ring-slate-900 dark:ring-white shadow-xl dark:shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-2xl dark:hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:-translate-y-1 overflow-hidden backdrop-blur-sm border border-transparent dark:border-white/20"
                    >
                        <span className="relative z-10 mr-2 text-lg md:text-xl tracking-wider font-mono">INITIALIZE_PORTAL</span>
                        <ArrowRight className="relative z-10 w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" />
                    </button>
                    <p className="mt-4 text-[10px] md:text-xs text-slate-500 font-mono">
                        POWERED BY GEMINI 2.5 • VIRUSTOTAL • GOOGLE SEARCH
                    </p>
                </div>
            </div>
            
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-50 pointer-events-none">
                <div className="w-5 h-8 md:w-6 md:h-10 border-2 border-slate-400 dark:border-slate-500 rounded-full flex justify-center pt-2">
                    <div className="w-1 h-2 bg-slate-600 dark:bg-white rounded-full animate-pulse"></div>
                </div>
            </div>
        </section>

        <div className="bg-white/80 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800 backdrop-blur-sm overflow-hidden py-3">
             <div className="flex gap-12 animate-marquee whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-xs md:text-sm uppercase tracking-wider">
                 <span className="flex items-center gap-2"><AlertCircle size={14}/> Phishing Attempt Blocked (IP: 192.168.x.x)</span>
                 <span className="flex items-center gap-2"><Check size={14}/> Fact Verified: "Solar flare outage" {'>'} FALSE</span>
                 <span className="flex items-center gap-2"><AlertCircle size={14}/> Deepfake Audio Detected (Confidence: 98%)</span>
                 <span className="flex items-center gap-2"><Database size={14}/> Database Updated: 2.4M new signatures</span>
                 <span className="flex items-center gap-2"><Globe size={14}/> Node Singapore: ONLINE</span>
             </div>
        </div>

        <section className="py-12 md:py-20 px-6 bg-[#f8fafc] dark:bg-slate-950 border-b border-slate-200 dark:border-slate-900">
            <div className="max-w-7xl mx-auto text-center">
                 <h2 className="text-xs md:text-sm font-mono text-slate-500 uppercase tracking-widest mb-10">Powered By Next-Gen Infrastructure</h2>
                 <div className="flex flex-wrap justify-center gap-6 md:gap-16 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
                      <div className="flex items-center gap-2 text-base md:text-xl font-bold text-slate-700 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          <Cpu className="text-blue-500" size={20} /> Gemini 2.5
                      </div>
                       <div className="flex items-center gap-2 text-base md:text-xl font-bold text-slate-700 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                          <ShieldCheck className="text-indigo-500" size={20} /> VirusTotal v3
                      </div>
                       <div className="flex items-center gap-2 text-base md:text-xl font-bold text-slate-700 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                          <Search className="text-emerald-500" size={20} /> Google Grounding
                      </div>
                       <div className="flex items-center gap-2 text-base md:text-xl font-bold text-slate-700 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                          <Layers className="text-orange-500" size={20} /> TensorFlow
                      </div>
                 </div>
            </div>
        </section>

        <section className="relative py-12 md:py-24 px-6 bg-[#f8fafc] dark:bg-slate-950">
             <div className="max-w-7xl mx-auto">
                 <div className="text-center mb-10 md:mb-16">
                     <h2 className="text-3xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-white">Core Capabilities</h2>
                     <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-sm md:text-base">Three pillars of defense for the modern information ecosystem.</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    <FeatureCard 
                        icon={Search} 
                        title="Truth Engine" 
                        desc="Real-time fact verification using Google Search grounding. We cross-reference claims against millions of trusted sources in milliseconds."
                        color="cyan"
                    />
                     <FeatureCard 
                        icon={FileWarning} 
                        title="Fraud Shield" 
                        desc="Advanced heuristics analyze emails, files, and URLs. We verify cryptographic hashes against global malware databases."
                        color="yellow"
                    />
                     <FeatureCard 
                        icon={Video} 
                        title="Deepfake Scan" 
                        desc="Multi-modal forensic analysis detects pixel-level warping, audio spectrum artifacts, and synthetic generation patterns."
                        color="purple"
                    />
                 </div>
             </div>
        </section>

        <section className="py-12 md:py-24 px-6 bg-[#f8fafc] dark:bg-slate-950 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white to-transparent opacity-30 dark:opacity-10"></div>
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/20 text-slate-800 dark:text-white text-xs font-mono uppercase">
                        <Activity size={12} className="animate-pulse" /> Live Interception
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Real-time threat neutrality.</h2>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm md:text-base">
                        Watch as Sacch.ai processes thousands of signals per second, isolating malicious payloads and synthetic media before they cause harm.
                    </p>
                </div>
                <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs md:text-sm relative h-[300px] md:h-[400px] flex flex-col transform md:rotate-1 hover:rotate-0 transition-transform duration-500">
                    <div className="bg-slate-800 p-3 flex items-center gap-2 border-b border-slate-700">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="ml-2 text-slate-400 truncate">sacch-cli — ssh root@node-sg-1</span>
                    </div>
                    <div className="p-4 space-y-2 overflow-hidden flex-1 relative bg-black/90 text-slate-300">
                        <div className="animate-terminal-scroll space-y-2 absolute bottom-0 left-4 right-4">
                             <div className="text-emerald-500">✓ [SUCCESS] Handshake established with Node-Tokyo-4</div>
                             <div className="text-slate-400">{'>'} Analyzing packet header... [SHA256: e3b0c442...]</div>
                             <div className="text-yellow-500">⚠ [WARN] Heuristic mismatch in audio stream (44.1kHz)</div>
                             <div className="text-slate-400">{'>'} Rerouting to Gemini-Pro-Vision for deep scan...</div>
                             <div className="text-red-400">✕ [BLOCK] Phishing pattern detected: "Urgent: Account Suspended"</div>
                             <div className="text-slate-400">{'>'} Updating local threat cache...</div>
                             <div className="text-emerald-500">✓ [VERIFIED] Claim "Inflation at 2%" {'>'} FALSE</div>
                             <div className="text-slate-400">{'>'} Idle... awaiting input stream.</div>
                             <div className="text-slate-500 animate-pulse">_</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section className="py-12 md:py-24 px-6 bg-[#f8fafc] dark:bg-slate-950">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-10 md:mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-white">Autonomous Verification</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base">From input to verdict in three steps.</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                     <StepCard 
                        number="01" 
                        title="Ingest" 
                        desc="Upload files, paste text, or provide URLs. Data is hashed locally for privacy." 
                        icon={Code}
                     />
                      <StepCard 
                        number="02" 
                        title="Analyze" 
                        desc="Gemini 2.5 performs multi-modal reasoning while VirusTotal checks global databases." 
                        icon={Cpu}
                     />
                      <StepCard 
                        number="03" 
                        title="Report" 
                        desc="Receive a comprehensive verdict with confidence scores and evidence citations." 
                        icon={FileWarning}
                     />
                </div>
            </div>
        </section>

        <section className="relative py-12 md:py-24 px-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-200/50 to-slate-300/50 dark:from-slate-900/50 dark:to-slate-800/50"></div>
            <div className="max-w-4xl mx-auto text-center relative z-10 space-y-8">
                <h2 className="text-3xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight">
                    Secure Your Digital Perimeter.
                </h2>
                <button 
                    onClick={onEnter}
                    className="inline-flex items-center justify-center px-10 py-4 font-bold text-white bg-slate-900 dark:bg-white/10 hover:bg-slate-800 dark:hover:bg-white/20 border border-transparent dark:border-white/20 rounded-full transition-all backdrop-blur-md shadow-lg"
                >
                    LAUNCH PLATFORM
                </button>
            </div>
        </section>

        <div className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-black py-8 md:py-12 px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-xs md:text-sm text-slate-500 font-mono">
                    © 2025 SACCH.AI // SECURE SYSTEM // V2.5.0
                </div>
                 <div className="flex gap-8 text-center">
                    <div>
                        <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">2.5M+</div>
                        <div className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider">Scans Performed</div>
                    </div>
                    <div>
                        <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">0.02s</div>
                        <div className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider">Avg Latency</div>
                    </div>
                     <div>
                        <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">99%</div>
                        <div className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider">Uptime</div>
                    </div>
                </div>
            </div>
        </div>

        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
          }
          .delay-100 { animation-delay: 0.2s; }
          .delay-300 { animation-delay: 0.6s; }

          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            animation: marquee 30s linear infinite;
          }

          @keyframes terminalScroll {
             0% { transform: translateY(0); }
             100% { transform: translateY(-20px); } 
          }
        `}</style>
    </div>
  );
};

// --- Helper Components ---

const FeatureCard = ({ icon: Icon, title, desc, color }: any) => {
    const colorClasses: any = {
        cyan: "hover:shadow-cyan-500/30 hover:border-cyan-500/60",
        yellow: "hover:shadow-yellow-500/30 hover:border-yellow-500/60",
        purple: "hover:shadow-purple-500/30 hover:border-purple-500/60"
    };

    const iconColors: any = {
        cyan: "text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20",
        yellow: "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20",
        purple: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20"
    };

    return (
        <div className={`group relative p-6 md:p-8 bg-white dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl transition-all duration-300 hover:-translate-y-2 hover:bg-slate-50 dark:hover:bg-slate-900/60 ${colorClasses[color]} shadow-lg dark:shadow-2xl h-full`}>
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-500 bg-${color}-500 rounded-3xl`}></div>
            <div className="relative z-10 flex flex-col items-start space-y-5">
                <div className={`p-4 rounded-2xl border ${iconColors[color]} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                    <Icon size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 font-mono uppercase tracking-tight">{title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                        {desc}
                    </p>
                </div>
            </div>
        </div>
    )
};

const StepCard = ({ number, title, desc, icon: Icon }: any) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl hover:border-cyan-500/30 transition-colors group shadow-lg dark:shadow-none">
        <div className="flex justify-between items-start mb-6">
            <div className="text-3xl md:text-4xl font-black text-slate-200 dark:text-slate-800 group-hover:text-cyan-600/20 dark:group-hover:text-cyan-900/50 transition-colors">{number}</div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg group-hover:scale-110 transition-transform">
                <Icon size={24} className="text-cyan-600 dark:text-cyan-500" />
            </div>
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
);

export default LandingPage;