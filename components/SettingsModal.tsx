
import React, { useState } from 'react';
import { UserSettings } from '../types';

interface SettingsModalProps {
  initialSettings: UserSettings;
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ initialSettings, onSave, onClose }) => {
  const [name, setName] = useState(initialSettings.name);
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, apiKey, isDarkMode: true }); // Always pass true for dark mode
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="glass rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="p-6 flex justify-between items-center border-b border-white/10">
          <h3 className="text-xl font-bold text-white tracking-tight">Configuration</h3>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Identity</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Namamu"
                className="w-full p-4 bg-black/20 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 ring-indigo-500/50 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Gemini Secret</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key"
                className="w-full p-4 bg-black/20 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 ring-indigo-500/50 transition-all font-medium"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full py-5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold rounded-2xl shadow-xl hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Apply Changes
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;
