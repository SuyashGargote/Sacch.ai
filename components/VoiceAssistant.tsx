import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Activity, Power, Info, Volume2, Radio, User, Cpu, Pause, Play, Send } from 'lucide-react';
import { LoadingSpinner } from './ui/LoadingSpinner';

// --- Audio Utils ---

function base64EncodeAudio(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  let binary = '';
  const bytes = new Uint8Array(int16Array.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

interface TranscriptItem {
  role: 'user' | 'ai';
  text: string;
}

const VoiceAssistant: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'PAUSED'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  
  // Transcription State
  const [history, setHistory] = useState<TranscriptItem[]>([]);
  const [liveInput, setLiveInput] = useState("");
  const [liveOutput, setLiveOutput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Refs for Audio Contexts and Session
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null); 
  const nextStartTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Refs for accumulation to avoid closure staleness
  const currentInputRef = useRef("");
  const currentOutputRef = useRef("");
  const isPausedRef = useRef(false);
  // Track mute state in ref for synchronous access in audio callbacks
  const isMutedRef = useRef(false);
  // Track if we are intentionally stopping to prevent race conditions
  const isStoppingRef = useRef(false);

  useEffect(() => {
    // Auto-scroll to bottom of transcript
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, liveInput, liveOutput]);

  const cleanupAudio = () => {
    sourceNodesRef.current.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    sourceNodesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const startSession = async () => {
    setError(null);
    setStatus('CONNECTING');
    setHistory([]);
    setLiveInput("");
    setLiveOutput("");
    setIsPaused(false);
    setIsMuted(false);
    isPausedRef.current = false;
    isMutedRef.current = false;
    currentInputRef.current = "";
    currentOutputRef.current = "";
    isStoppingRef.current = false;
    cleanupAudio();

    try {
      if (!process.env.GEMINI_API_KEY) {
         throw new Error("API Key is missing in environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      
      // IMPORTANT: Resume contexts immediately to prevent "suspended" state on some browsers
      await Promise.all([inputCtx.resume(), outputCtx.resume()]);

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // Get Microphone Stream with robust error handling
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (e) {
        throw new Error("Microphone permission denied. Please allow access to use the assistant.");
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Opened");
            if (isStoppingRef.current) return;
            setStatus('LISTENING');
            setIsActive(true);

            // Start Input Stream Processing
            const source = inputCtx.createMediaStreamSource(stream);
            // Reduced buffer size to 2048 (approx 128ms) for lower latency
            const processor = inputCtx.createScriptProcessor(2048, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
               // If muted, paused, stopping, or session is not available, do not send data
               if (isMutedRef.current || isPausedRef.current || isStoppingRef.current || !sessionRef.current) {
                  return;
               }

               const inputData = e.inputBuffer.getChannelData(0);
               const base64Data = base64EncodeAudio(inputData);
               
               // Send data immediately when session is available
               sessionPromise.then(session => {
                   if (!isStoppingRef.current && session && sessionRef.current === session) {
                     session.sendRealtimeInput({
                         media: {
                             mimeType: "audio/pcm;rate=16000",
                             data: base64Data
                         }
                     });
                   }
               }).catch(e => {
                   console.error("Audio Send Error:", e);
               });
            };

            // Prevent feedback loop
            const silence = inputCtx.createGain();
            silence.gain.value = 0;
            source.connect(processor);
            processor.connect(silence);
            silence.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (isStoppingRef.current) return;

            // 1. Handle Transcriptions
            const serverContent = message.serverContent;
            
            if (serverContent?.inputTranscription) {
                const text = serverContent.inputTranscription.text;
                if (text) {
                    currentInputRef.current += text;
                    setLiveInput(currentInputRef.current);
                }
            }
            
            if (serverContent?.outputTranscription) {
                const text = serverContent.outputTranscription.text;
                if (text) {
                    currentOutputRef.current += text;
                    setLiveOutput(currentOutputRef.current);
                }
            }

            if (serverContent?.turnComplete) {
                if (currentInputRef.current.trim()) {
                    setHistory(prev => [...prev, { role: 'user', text: currentInputRef.current }]);
                    currentInputRef.current = "";
                    setLiveInput("");
                }
                if (currentOutputRef.current.trim()) {
                    setHistory(prev => [...prev, { role: 'ai', text: currentOutputRef.current }]);
                    currentOutputRef.current = "";
                    setLiveOutput("");
                }
            }

            // 2. Handle Audio Output (Ignore if paused)
            const audioData = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && !isPausedRef.current) {
               setStatus('SPEAKING');
               const audioBytes = base64ToUint8Array(audioData);
               
               // Decode Audio (PCM 16-bit to Float32)
               const dataInt16 = new Int16Array(audioBytes.buffer);
               const frameCount = dataInt16.length;
               const audioBuffer = outputCtx.createBuffer(1, frameCount, 24000);
               const channelData = audioBuffer.getChannelData(0);
               for (let i = 0; i < frameCount; i++) {
                   channelData[i] = dataInt16[i] / 32768.0;
               }

               // Schedule Playback
               const source = outputCtx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(outputCtx.destination);
               
               const currentTime = outputCtx.currentTime;
               const startTime = Math.max(currentTime, nextStartTimeRef.current);
               source.start(startTime);
               nextStartTimeRef.current = startTime + audioBuffer.duration;
               
               sourceNodesRef.current.add(source);
               source.onended = () => {
                   sourceNodesRef.current.delete(source);
                   if (sourceNodesRef.current.size === 0 && !isPausedRef.current && sessionRef.current && !isStoppingRef.current) {
                       setStatus('LISTENING');
                   }
               };
            }

            // 3. Handle Interruption
            if (serverContent?.interrupted) {
                console.log("Interrupted");
                cleanupAudio();
                
                // If we interrupted, commit partial transcript
                if (currentOutputRef.current.trim()) {
                     setHistory(prev => [...prev, { role: 'ai', text: currentOutputRef.current + " [Interrupted]" }]);
                     currentOutputRef.current = "";
                     setLiveOutput("");
                }
                
                // Reset nextStartTime to now to avoid scheduling delays
                if (outputCtx) {
                    nextStartTimeRef.current = outputCtx.currentTime;
                }

                if (!isPausedRef.current) {
                    setStatus('LISTENING');
                }
            }
          },
          onclose: (e) => {
             console.log("Session Closed", e);
             // Clear session reference immediately to prevent further sends
             sessionRef.current = null;
             
             // Stop audio processing
             if (processorRef.current) {
                processorRef.current.disconnect();
                processorRef.current = null;
             }
             
             // Only stop full session if it's an intentional user action
             if (isStoppingRef.current) {
                stopSession();
             } else {
                // Session closed unexpectedly, clean up but don't auto-stop
                console.warn("Session closed unexpectedly during conversation");
                setError("Connection lost unexpectedly. You may need to restart the session.");
                setStatus('IDLE');
                setIsActive(false);
                
                // Clean up audio contexts and streams
                cleanupAudio();
                if (streamRef.current) {
                   streamRef.current.getTracks().forEach(track => track.stop());
                   streamRef.current = null;
                }
                if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
                   inputAudioContextRef.current.close();
                   inputAudioContextRef.current = null;
                }
                if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
                   outputAudioContextRef.current.close();
                   outputAudioContextRef.current = null;
                }
                
                // Attempt to reconnect after delay
                setTimeout(() => {
                    if (!isStoppingRef.current && !sessionRef.current) {
                        startSession();
                    }
                }, 3000);
             }
          },
          onerror: (err) => {
             console.error("Session Error (Callback):", err);
             let msg = "Connection encountered an error.";
             // ErrorEvent usually doesn't have a useful message, but try:
             if (err instanceof Error) {
               msg = err.message;
             } else if ((err as any).error && (err as any).error.message) {
               msg = (err as any).error.message;
             }
             
             // Ignore "close" errors if we are stopping
             if (!isStoppingRef.current) {
                setError(msg);
                stopSession();
             }
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: "You are a helpful and vigilant security assistant for Sacch.ai. Your goal is to help users verify facts, identify scams, and detect deepfakes. Be concise, professional, and reassuring. If a user asks about a specific file or url, guide them to use the specific tools in the app.",
        }
      });
      
      // Catch initial connection errors (e.g. 404 Model not found, 403 Forbidden, Network Error)
      sessionPromise.then(sess => {
          if (isStoppingRef.current) {
             // If we stopped while connecting, close immediately
             sess.close(); 
             return;
          }
          sessionRef.current = sess;
      }).catch(err => {
          console.error("Connection Promise Rejected:", err);
          let errorMsg = "Failed to connect. ";
          if (err.message) {
            if (err.message.includes("404")) errorMsg += "Model not found.";
            else if (err.message.includes("403")) errorMsg += "Access denied/Quota exceeded.";
            else if (err.message.includes("Network")) errorMsg += "Network error. Check firewall/VPN.";
            else errorMsg += err.message;
          }
          setError(errorMsg);
          setStatus('IDLE');
          setIsActive(false);
          // Force stop to clean up streams/contexts
          stopSession();
      });

    } catch (err: any) {
      console.error("Initialization Error:", err);
      setError(err.message || "Failed to initialize audio or API.");
      setStatus('IDLE');
      // Ensure we clean up any partial state
      stopSession(); 
    }
  };

  const stopSession = () => {
    isStoppingRef.current = true;
    cleanupAudio();

    try {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        
        // Close session if it exists
        if (sessionRef.current) {
            // Note: .close() might trigger onclose, but we set isStoppingRef to ignore it
            // sessionRef.current.close(); 
        }
    } catch (e) {
        console.warn("Error during cleanup:", e);
    }
    
    sessionRef.current = null;
    setIsActive(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setStatus('IDLE');
  };

  const toggleMute = () => {
      const newState = !isMuted;
      setIsMuted(newState);
      isMutedRef.current = newState;
  };

  const togglePause = () => {
      const newPausedState = !isPaused;
      setIsPaused(newPausedState);
      isPausedRef.current = newPausedState;

      if (newPausedState) {
          setStatus('PAUSED');
          cleanupAudio();
      } else {
          // Resuming
          setStatus('LISTENING');
          // Reset scheduler to now
          if (outputAudioContextRef.current) {
             nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
          }
      }
  };

  const handleSendText = (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!textInput.trim() || !sessionRef.current || !isActive) return;
  
      const text = textInput.trim();
      
      // Optimistic update
      setHistory(prev => [...prev, { role: 'user', text: text }]);
      setTextInput("");
  
      try {
          // Send text input to Gemini Live
          sessionRef.current.send({
              clientContent: {
                  turns: [{ role: 'user', parts: [{ text: text }] }],
                  turnComplete: true
              }
          });
      } catch (e) {
          console.error("Error sending text:", e);
      }
  };

  useEffect(() => {
      return () => {
          stopSession();
      };
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-6 md:gap-8 h-auto lg:h-[calc(100vh-10rem)] min-h-[calc(100vh-10rem)]">
      
      {/* Left Panel: Visualizer & Controls */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 md:space-y-12 bg-white dark:bg-slate-900/50 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-sm min-h-[400px]">
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600 dark:from-pink-400 dark:to-purple-400">
              Live Assistant
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto text-sm">
              Voice-activated security consultation. Speak clearly to verify threats.
            </p>
          </div>

          {/* Visualizer */}
          <div className="relative">
             <div className={`absolute inset-0 rounded-full blur-[60px] transition-all duration-700 ${
                 status === 'SPEAKING' ? 'bg-pink-500/30 scale-150' : 
                 status === 'LISTENING' ? 'bg-cyan-500/20 scale-110' : 
                 status === 'PAUSED' ? 'bg-yellow-500/10 scale-100' :
                 'bg-slate-800/0 scale-100'
             }`}></div>

             <div className={`
                relative w-48 h-48 md:w-64 md:h-64 rounded-full border-4 flex items-center justify-center transition-all duration-500 bg-slate-950 dark:bg-slate-950
                ${status === 'IDLE' ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950' : 
                  status === 'CONNECTING' ? 'border-yellow-500/50 animate-pulse bg-white dark:bg-slate-950' :
                  status === 'LISTENING' ? 'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)] bg-white dark:bg-slate-950' :
                  status === 'PAUSED' ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)] bg-white dark:bg-slate-950' :
                  'border-pink-500 shadow-[0_0_50px_rgba(236,72,153,0.5)] scale-105 bg-white dark:bg-slate-950'
                }
             `}>
                 {status === 'IDLE' && <Radio size={64} className="text-slate-400 dark:text-slate-700 w-12 h-12 md:w-16 md:h-16" />}
                 {status === 'CONNECTING' && <LoadingSpinner />}
                 
                 {status === 'LISTENING' && (
                     <div className="space-y-4 text-center">
                         <Mic size={48} className={`mx-auto text-cyan-600 dark:text-cyan-400 w-10 h-10 md:w-12 md:h-12 ${!isMuted ? 'animate-bounce' : 'opacity-50'}`} />
                         <p className="text-cyan-600 dark:text-cyan-400 font-mono text-[10px] md:text-xs tracking-widest animate-pulse">LISTENING...</p>
                     </div>
                 )}

                 {status === 'SPEAKING' && (
                     <div className="space-y-4 text-center">
                         <div className="flex justify-center gap-1 h-12 items-center">
                             {[1,2,3,4,5].map(i => (
                                 <div key={i} className="w-1.5 md:w-2 bg-pink-500 rounded-full animate-wave" style={{animationDelay: `${i * 0.1}s`}}></div>
                             ))}
                         </div>
                         <p className="text-pink-600 dark:text-pink-400 font-mono text-[10px] md:text-xs tracking-widest">SPEAKING...</p>
                     </div>
                 )}

                 {status === 'PAUSED' && (
                     <div className="space-y-4 text-center">
                         <Pause size={48} className="mx-auto text-yellow-500 w-10 h-10 md:w-12 md:h-12" />
                         <p className="text-yellow-600 dark:text-yellow-500 font-mono text-[10px] md:text-xs tracking-widest">PAUSED</p>
                     </div>
                 )}
             </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 z-10 w-full">
              {!isActive ? (
                 <button
                   onClick={startSession}
                   className="group relative px-6 py-3 md:px-8 md:py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-full text-white font-bold text-base md:text-lg shadow-xl shadow-purple-900/30 transition-all hover:scale-105 flex items-center gap-3"
                 >
                     <Power size={20} className="md:w-6 md:h-6" />
                     Start Conversation
                 </button>
              ) : (
                 <>
                    <button 
                      onClick={toggleMute}
                      disabled={isPaused}
                      className={`p-3 md:p-4 rounded-full border transition-all ${
                          isMuted 
                          ? 'bg-red-100 dark:bg-red-500/20 border-red-500 text-red-600 dark:text-red-500 hover:bg-red-200 dark:hover:bg-red-500/30' 
                          : isPaused 
                              ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                        {isMuted ? <MicOff size={20} className="md:w-6 md:h-6" /> : <Mic size={20} className="md:w-6 md:h-6" />}
                    </button>

                    <button
                      onClick={togglePause}
                      className={`p-3 md:p-4 rounded-full border transition-all ${
                          isPaused
                          ? 'bg-yellow-100 dark:bg-yellow-500/20 border-yellow-500 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-200 dark:hover:bg-yellow-500/30'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title={isPaused ? "Resume Session" : "Pause Session"}
                    >
                        {isPaused ? <Play size={20} className="md:w-6 md:h-6" /> : <Pause size={20} className="md:w-6 md:h-6" />}
                    </button>

                    <button
                      onClick={stopSession}
                      className="px-6 py-3 md:px-8 md:py-4 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 hover:border-red-500 border border-slate-200 dark:border-slate-700 rounded-full text-slate-700 dark:text-white font-bold transition-all flex items-center gap-3 text-sm md:text-base"
                    >
                        <Power size={18} className="text-red-500 dark:text-red-400 md:w-5 md:h-5" />
                        End Session
                    </button>
                 </>
              )}
          </div>
          
          <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500 font-mono">
             <Activity size={12} className={isActive ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'} />
             {isActive ? 'ENCRYPTED_LINK_ESTABLISHED' : 'SYSTEM_STANDBY'}
          </div>
          {error && <span className="text-xs md:text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/30 px-3 py-1 rounded border border-red-200 dark:border-red-900 animate-pulse">{error}</span>}
      </div>

      {/* Right Panel: Transcript */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl h-[400px] lg:h-auto">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Volume2 size={18} className="text-pink-600 dark:text-pink-400" />
                  Live Transcript
              </h3>
              {isActive && !isPaused && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
          </div>
          
          <div 
             ref={scrollRef}
             className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar scroll-smooth"
          >
              {history.length === 0 && !liveInput && !liveOutput && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 space-y-2 opacity-50">
                      <Mic size={32} />
                      <p className="text-sm">Transcript will appear here...</p>
                  </div>
              )}

              {history.map((item, idx) => (
                  <div key={idx} className={`flex gap-3 ${item.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center shrink-0
                          ${item.role === 'user' ? 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400' : 'bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400'}
                      `}>
                          {item.role === 'user' ? <User size={14} /> : <Cpu size={14} />}
                      </div>
                      <div className={`
                          rounded-2xl p-3 text-sm max-w-[85%]
                          ${item.role === 'user' 
                              ? 'bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/30 text-cyan-900 dark:text-cyan-100 rounded-tr-sm' 
                              : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-sm'}
                      `}>
                          {item.text}
                      </div>
                  </div>
              ))}

              {/* Live Input Streaming */}
              {liveInput && (
                   <div className="flex gap-3 flex-row-reverse opacity-70">
                      <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                          <User size={14} />
                      </div>
                      <div className="rounded-2xl p-3 text-sm max-w-[85%] bg-cyan-50 dark:bg-cyan-950/10 border border-cyan-100 dark:border-cyan-900/10 text-cyan-900 dark:text-cyan-100 rounded-tr-sm italic">
                          {liveInput}<span className="animate-pulse">_</span>
                      </div>
                   </div>
              )}

              {/* Live Output Streaming */}
              {liveOutput && (
                   <div className="flex gap-3 flex-row opacity-70">
                      <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                          <Cpu size={14} />
                      </div>
                      <div className="rounded-2xl p-3 text-sm max-w-[85%] bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-sm italic">
                          {liveOutput}<span className="animate-pulse">_</span>
                      </div>
                   </div>
              )}
          </div>
          
          {/* Text Input Footer */}
          <form onSubmit={handleSendText} className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={isActive ? "Type a message..." : "Start conversation to chat"}
                disabled={!isActive}
                className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed placeholder-slate-400"
            />
            <button
                type="submit"
                disabled={!isActive || !textInput.trim()}
                className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Send size={18} />
            </button>
          </form>
      </div>

      <style>{`
         @keyframes wave {
             0%, 100% { height: 10px; }
             50% { height: 40px; }
         }
         .animate-wave {
             animation: wave 1s ease-in-out infinite;
         }
      `}</style>
    </div>
  );
};

export default VoiceAssistant;