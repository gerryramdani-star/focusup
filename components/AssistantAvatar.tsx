
import React from 'react';
import { ConnectionState } from '../types';

interface AssistantAvatarProps {
  state: ConnectionState;
}

const AssistantAvatar: React.FC<AssistantAvatarProps> = ({ state }) => {
  const getColors = () => {
    switch (state) {
      case ConnectionState.LISTENING:
        return { ring: 'border-pink-500 shadow-pink-500/50', glow: 'bg-pink-500/20' };
      case ConnectionState.SPEAKING:
      case ConnectionState.THINKING:
      case ConnectionState.RECONNECTING:
        return { ring: 'border-indigo-500 shadow-indigo-500/50', glow: 'bg-indigo-500/20' };
      case ConnectionState.ERROR:
        return { ring: 'border-red-500 shadow-red-500/50', glow: 'bg-red-500/20' };
      default:
        return { ring: 'border-white/20 shadow-transparent', glow: 'bg-white/5' };
    }
  };

  const { ring, glow } = getColors();

  return (
    <div className="flex flex-col items-center justify-center p-6 glass rounded-[2rem] shadow-lg border-white/10 shrink-0 h-full relative overflow-hidden group">
      {/* Background Glow */}
      <div className={`absolute inset-0 transition-colors duration-1000 blur-3xl ${glow}`}></div>
      
      <div className="relative z-10 flex flex-col items-center">
        <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-2 p-1.5 transition-all duration-700 shadow-2xl relative ${ring} ${state !== ConnectionState.OFFLINE ? 'animate-float' : ''}`}>
          {/* Internal Pulse for active states */}
          {state !== ConnectionState.OFFLINE && state !== ConnectionState.ERROR && (
            <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${state === ConnectionState.LISTENING ? 'bg-pink-400' : 'bg-indigo-400'}`}></div>
          )}
          
          <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center border border-white/10">
            <svg viewBox="0 0 100 100" className="w-12 h-12 md:w-16 md:h-16">
               <defs>
                 <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                   <stop offset="0%" stopColor="#818cf8" />
                   <stop offset="100%" stopColor="#c084fc" />
                 </linearGradient>
               </defs>
               <circle cx="50" cy="35" r="18" fill="url(#avatarGrad)" />
               <path d="M20,80 Q50,40 80,80" fill="none" stroke="url(#avatarGrad)" strokeWidth="8" strokeLinecap="round" />
               {/* Eyes reacting to state */}
               <circle cx="43" cy="35" r="2.5" fill="white" className={state === ConnectionState.LISTENING ? 'animate-pulse' : ''} />
               <circle cx="57" cy="35" r="2.5" fill="white" className={state === ConnectionState.LISTENING ? 'animate-pulse' : ''} />
            </svg>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Your Personal AI</p>
          <h3 className="text-white font-bold text-sm md:text-base">
            {state === ConnectionState.OFFLINE ? 'FocusUp is Sleeping' : 
             state === ConnectionState.RECONNECTING ? 'FocusUp is Recovering' :
             state === ConnectionState.ERROR ? 'FocusUp is Disconnected' : 'FocusUp is Active'}
          </h3>
        </div>
      </div>
      
      {/* Interactive Tooltip-like badge */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-white/10 px-2 py-1 rounded-md border border-white/10">
           <p className="text-[8px] font-bold text-white uppercase tracking-tighter">V2.5 LIVE</p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default AssistantAvatar;
