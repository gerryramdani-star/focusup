import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { Task, UserSettings, ConnectionState } from './types';
import { COLORS, SYSTEM_INSTRUCTION } from './constants';
import { decodeBase64, encodeBase64, decodeAudioData, createPcmBlob } from './services/audioUtils';
import Visualizer from './components/Visualizer';
import TaskList from './components/TaskList';
import SettingsModal from './components/SettingsModal';
import AssistantAvatar from './components/AssistantAvatar';

const getLocalISODate = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
};

const storage = {
  getTasks: (): Task[] => JSON.parse(localStorage.getItem('standup_tasks') || '[]'),
  setTasks: (tasks: Task[]) => localStorage.setItem('standup_tasks', JSON.stringify(tasks)),
  getSettings: (): UserSettings => {
    const saved = localStorage.getItem('user_settings');
    if (saved) return JSON.parse(saved);
    return { name: '', apiKey: '', isDarkMode: true };
  },
  setSettings: (settings: UserSettings) => {
    localStorage.setItem('user_settings', JSON.stringify({ ...settings, isDarkMode: true }));
  },
};

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(storage.getTasks());
  const [settings, setSettings] = useState<UserSettings>(storage.getSettings());
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.OFFLINE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getLocalISODate());
  const [manualInput, setManualInput] = useState('');
  const [aiPrompt, setAiPrompt] = useState('Standup Ready');
  const [aiSubtext, setAiSubtext] = useState('Ketuk mic untuk memulai');
  const [transcription, setTranscription] = useState('');

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const tasksRef = useRef<Task[]>(tasks);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const isClosingRef = useRef(false);
  
  useEffect(() => {
    tasksRef.current = tasks;
    storage.setTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    document.body.classList.add('dark');
    
    const handleOnline = () => {
      if (connectionState === ConnectionState.ERROR) {
        setAiSubtext("Internet kembali terhubung. Siap mencoba lagi.");
      }
    };
    const handleOffline = () => {
      setAiSubtext("Koneksi terputus. Periksa internet Anda.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionState]);

  const handleUpdateTasks = (newTasks: Task[]) => setTasks(newTasks);

  const addTask = (content: string, dateStr: string) => {
    const timestamp = new Date(`${dateStr}T12:00:00`).toISOString();
    const newTask: Task = {
      id: (Date.now() + Math.random()).toString(),
      content,
      status: 'pending',
      priority: 'Normal',
      createdAt: timestamp,
    };
    handleUpdateTasks([...tasks, newTask]);
  };

  const stopSession = useCallback((resetUI = true) => {
    isClosingRef.current = true;
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }

    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    if (resetUI) {
      setConnectionState(ConnectionState.OFFLINE);
      setAiPrompt('FocusUp Offline');
      setAiSubtext('Ketuk mic untuk kembali');
      setTranscription('');
      retryCountRef.current = 0;
    }
    isClosingRef.current = false;
  }, []);

  const startSession = async (isReconnect = false) => {
    if (!settings.apiKey) {
      setConnectionState(ConnectionState.ERROR);
      setAiPrompt('API Key Kosong');
      setAiSubtext('Buka menu konfigurasi untuk input API Key.');
      setIsSettingsOpen(true);
      return;
    }

    if (!navigator.onLine) {
      setConnectionState(ConnectionState.ERROR);
      setAiPrompt('Network Error');
      setAiSubtext('Anda sedang offline.');
      return;
    }

    try {
      if (isReconnect) {
        setConnectionState(ConnectionState.RECONNECTING);
        setAiPrompt('Recovering...');
        setAiSubtext(`Mencoba memulihkan sesi (${retryCountRef.current}/${MAX_RETRIES})...`);
      } else {
        setConnectionState(ConnectionState.CONNECTING);
        setAiPrompt('Synchronizing...');
        retryCountRef.current = 0;
      }
      
      const ai = new GoogleGenAI({ apiKey: settings.apiKey });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;

      const analyser = outputCtx.createAnalyser();
      analyserRef.current = analyser;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const updateTodoListFn: FunctionDeclaration = {
        name: 'update_todo_list',
        description: 'Add new tasks to the list.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            new_tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { 
                  content: { type: Type.STRING }, 
                  date: { type: Type.STRING },
                  status: { type: Type.STRING } 
                },
                required: ['content']
              }
            }
          }
        }
      };

      const getTodoListFn: FunctionDeclaration = {
        name: 'get_todo_list',
        description: 'Retrieve tasks for specific dates.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING }
          }
        }
      };

      const updateTaskPrioritiesFn: FunctionDeclaration = {
        name: 'update_task_priorities',
        description: 'Update the priority of existing tasks based on content analysis.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            priorities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low', 'Normal'] }
                },
                required: ['id', 'priority']
              }
            }
          }
        }
      };

      const personalizedInstruction = SYSTEM_INSTRUCTION + (settings.name ? `\nIdentitas Pengguna Aktif:\nNama User: ${settings.name}` : '\nIdentitas Pengguna: Tidak diketahui.');

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: personalizedInstruction,
          tools: [{ functionDeclarations: [updateTodoListFn, getTodoListFn, updateTaskPrioritiesFn] }]
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.LISTENING);
            setAiPrompt('Listening...');
            setAiSubtext(`Halo ${settings.name || 'Sobat'}, silakan bicara`);
            retryCountRef.current = 0;

            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const pcmData = createPcmBlob(e.inputBuffer.getChannelData(0));
              sessionPromise.then(s => {
                if (!isClosingRef.current && s) {
                  s.sendRealtimeInput({ media: { data: pcmData, mimeType: 'audio/pcm;rate=16000' } });
                }
              }).catch(() => {});
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription?.text) {
              setTranscription(prev => prev + (message.serverContent?.outputTranscription?.text || ''));
            }

            if (message.serverContent?.turnComplete) {
              setTranscription('');
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setConnectionState(ConnectionState.SPEAKING);
              setAiPrompt('FocusUp Assistant');
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(analyser);
              analyser.connect(outputCtx.destination);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0 && !isClosingRef.current) setConnectionState(ConnectionState.LISTENING);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.toolCall?.functionCalls) {
              setConnectionState(ConnectionState.THINKING);
              setAiPrompt('Analyzing...');
              
              for (const fc of message.toolCall.functionCalls) {
                let response: any = { result: "ok" };
                if (fc.name === 'update_todo_list') {
                  const items = (fc.args as any).new_tasks;
                  if (items) {
                    setTasks(prev => {
                      const newItems = items.map((i: any) => ({
                        id: (Date.now() + Math.random()).toString(), 
                        content: i.content, 
                        status: i.status || 'pending', 
                        priority: 'Normal',
                        createdAt: i.date ? new Date(`${i.date}T12:00:00`).toISOString() : new Date().toISOString()
                      }));
                      return [...prev, ...newItems];
                    });
                  }
                } else if (fc.name === 'get_todo_list') {
                  const filterDate = (fc.args as any).date;
                  let filtered = tasksRef.current;
                  if (filterDate) {
                    filtered = filtered.filter(t => {
                      const tDate = new Date(t.createdAt);
                      const offset = tDate.getTimezoneOffset();
                      const localTDate = new Date(tDate.getTime() - (offset * 60 * 1000));
                      return localTDate.toISOString().startsWith(filterDate);
                    });
                  }
                  response = { 
                    tasks: filtered.map(t => ({ id: t.id, content: t.content, status: t.status, date: t.createdAt.split('T')[0] })),
                    context_date: filterDate || 'today' 
                  };
                } else if (fc.name === 'update_task_priorities') {
                   const updates = (fc.args as any).priorities;
                   if (updates) {
                     setTasks(prev => prev.map(t => {
                       const up = updates.find((u: any) => u.id === t.id);
                       return up ? { ...t, priority: up.priority } : t;
                     }));
                   }
                   response = { result: "priorities updated" };
                }
                
                sessionPromise.then(s => {
                  if (!isClosingRef.current && s) {
                    s.sendToolResponse({ 
                      functionResponses: [{ id: fc.id, name: fc.name, response }]
                    });
                  }
                }).catch(() => {});
              }
            }
          },
          onerror: (e: any) => {
            console.error('Live API Session Error:', e);
            if (isClosingRef.current) return;
            
            const isNetworkError = e?.message?.toLowerCase().includes('network') || e?.message?.toLowerCase().includes('fetch') || e?.message?.toLowerCase().includes('aborted');
            const isInvalidKey = e?.message?.toLowerCase().includes('api key') || e?.message?.toLowerCase().includes('unauthorized');

            if (isInvalidKey) {
              setConnectionState(ConnectionState.ERROR);
              setAiPrompt('API Key Error');
              setAiSubtext("API Key tidak valid. Silakan cek menu konfigurasi.");
              stopSession(false);
              return;
            }
            
            if (isNetworkError && retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              stopSession(false);
              const delay = Math.pow(2, retryCountRef.current) * 1000;
              reconnectTimeoutRef.current = window.setTimeout(() => startSession(true), delay);
            } else {
              setConnectionState(ConnectionState.ERROR);
              setAiPrompt('Connection Failed');
              setAiSubtext(isNetworkError ? "Masalah jaringan permanen. Ketuk untuk mencoba ulang." : "Terjadi kesalahan sistem.");
              stopSession(false);
            }
          },
          onclose: (e: any) => {
            console.log('Session closed', e);
            if (isClosingRef.current) return;
            
            if (connectionState !== ConnectionState.OFFLINE && connectionState !== ConnectionState.ERROR && retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              stopSession(false);
              const delay = Math.pow(2, retryCountRef.current) * 1000;
              reconnectTimeoutRef.current = window.setTimeout(() => startSession(true), delay);
            } else {
              stopSession();
            }
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { 
      console.error("Failed to start session:", err);
      if (!isReconnect) {
        setConnectionState(ConnectionState.ERROR);
        setAiPrompt('Startup Error');
        setAiSubtext("Gagal mengakses microphone atau server.");
        stopSession(false); 
      } else if (retryCountRef.current < MAX_RETRIES) {
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        reconnectTimeoutRef.current = window.setTimeout(() => startSession(true), delay);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto transition-all duration-300">
      <header className="flex justify-between items-center mb-6 md:mb-8 shrink-0">
        <div className="flex items-center gap-3 md:gap-5">
          <div className="w-10 h-10 md:w-14 md:h-14 glass rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
            <i className="fa-solid fa-microphone-lines text-indigo-500 text-lg md:text-2xl"></i>
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight leading-none mb-1">FocusUp</h1>
            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-80">Smart Ranking Edition</p>
          </div>
        </div>
        
        <div className="flex gap-2 md:gap-4">
          <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 md:w-12 md:h-12 glass rounded-xl md:rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-white shadow-md">
            <i className="fa-solid fa-sliders text-sm md:text-base"></i>
          </button>
          
          <div className="glass px-3 md:px-5 py-2 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3 shadow-md border-white/10">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
              connectionState === ConnectionState.OFFLINE ? 'bg-slate-400' :
              connectionState === ConnectionState.THINKING || connectionState === ConnectionState.RECONNECTING ? 'bg-indigo-400 animate-pulse' :
              connectionState === ConnectionState.ERROR ? 'bg-red-500' :
              connectionState === ConnectionState.CONNECTING ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-500'
            }`}></div>
            <span className="text-[9px] md:text-xs font-bold text-white uppercase tracking-tighter">{connectionState}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8 min-h-0">
        <section className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          <div className="relative min-h-[350px] lg:flex-1 flex flex-col items-center glass rounded-[2rem] shadow-xl overflow-hidden group">
            <Visualizer analyser={analyserRef.current} connectionState={connectionState} />
            
            <div className="z-10 h-full w-full flex flex-col items-center py-8 lg:py-10">
              <div className="flex-1 flex items-center justify-center px-6">
                {transcription && (
                  <div className="bg-black/40 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="text-sm lg:text-base text-indigo-200 font-medium italic leading-relaxed text-center">
                      "{transcription}"
                    </p>
                  </div>
                )}
              </div>
              
              <div className="relative shrink-0 my-4">
                <button 
                  onClick={connectionState === ConnectionState.OFFLINE || connectionState === ConnectionState.ERROR ? () => startSession() : () => stopSession()}
                  className={`w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center text-xl md:text-2xl transition-all duration-500 shadow-2xl relative z-20 ${
                    connectionState === ConnectionState.OFFLINE || connectionState === ConnectionState.ERROR
                    ? 'bg-white/10 hover:scale-105 hover:bg-white/20 text-white' 
                    : connectionState === ConnectionState.THINKING || connectionState === ConnectionState.RECONNECTING ? 'bg-indigo-600 text-white animate-bounce' : 'bg-red-500 text-white animate-pulse'
                  }`}
                >
                  <i className={`fa-solid ${connectionState === ConnectionState.OFFLINE || connectionState === ConnectionState.ERROR ? 'fa-microphone' : 'fa-stop-circle'}`}></i>
                </button>
              </div>

              <div className="shrink-0 flex flex-col items-center justify-center space-y-2 px-6 text-center">
                <h2 className={`text-lg md:text-xl font-bold tracking-tight ${connectionState === ConnectionState.ERROR ? 'text-red-400' : 'text-white'}`}>{aiPrompt}</h2>
                <div className="px-4 py-1.5 bg-white/5 rounded-full inline-block border border-indigo-500/20 max-w-full">
                  <p className="text-[10px] md:text-xs font-bold text-indigo-300 truncate">{aiSubtext}</p>
                </div>
              </div>
            </div>
          </div>

          <AssistantAvatar state={connectionState} />
        </section>

        <section className="lg:col-span-7 flex flex-col gap-6 min-h-0">
          <div className="h-[500px] lg:flex-1 min-h-0">
            <TaskList 
              tasks={tasks} 
              onToggle={(id) => handleUpdateTasks(tasks.map(t => t.id === id ? {...t, status: t.status === 'done' ? 'pending' : 'done'} : t))} 
              onDelete={(id) => handleUpdateTasks(tasks.filter(t => t.id !== id))} 
              onCopy={() => { navigator.clipboard.writeText(tasks.map(t => `[${t.status}] ${t.content}`).join('\n')); alert('Copied!'); }}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
            />
          </div>

          <div className="p-3 lg:p-4 glass rounded-[2rem] flex gap-2 lg:gap-3 shadow-lg border-white/10 shrink-0">
            <input 
              type="text" 
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={`Tambah tugas untuk ${selectedDate}...`}
              className="flex-1 min-w-0 px-4 md:px-5 py-3 lg:py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none text-white font-bold text-sm lg:text-base placeholder:text-slate-600 transition-all"
              onKeyDown={(e) => { if (e.key === 'Enter' && manualInput) { addTask(manualInput, selectedDate); setManualInput(''); } }}
            />
            <button onClick={() => { if (manualInput) { addTask(manualInput, selectedDate); setManualInput(''); } }} className="w-12 h-12 lg:w-14 lg:h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 shrink-0">
              <i className="fa-solid fa-plus text-lg lg:text-xl"></i>
            </button>
          </div>
        </section>
      </main>

      {isSettingsOpen && <SettingsModal initialSettings={settings} onSave={(s) => { setSettings(s); storage.setSettings(s); setIsSettingsOpen(false); }} onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};

export default App;
