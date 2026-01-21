
import React, { useMemo } from 'react';
import { Task, TaskPriority } from '../types';

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy: () => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({ 
  tasks, onToggle, onDelete, onCopy, selectedDate, setSelectedDate 
}) => {
  const filteredTasks = useMemo(() => {
    const list = tasks.filter(task => {
      const taskDate = new Date(task.createdAt);
      const offset = taskDate.getTimezoneOffset();
      const localTaskDate = new Date(taskDate.getTime() - (offset * 60 * 1000));
      return localTaskDate.toISOString().startsWith(selectedDate);
    });

    const priorityOrder: Record<string, number> = {
      'High': 0,
      'Medium': 1,
      'Normal': 2,
      'Low': 3
    };

    return list.sort((a, b) => {
      // Menggunakan fallback value (2 untuk Normal) jika prioritas tidak ditemukan
      const pA = priorityOrder[a.priority || 'Normal'] ?? 2;
      const pB = priorityOrder[b.priority || 'Normal'] ?? 2;
      
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, selectedDate]);
  
  const pendingCount = filteredTasks.filter(t => t.status === 'pending').length;

  const getPriorityColor = (priority?: TaskPriority) => {
    switch (priority) {
      case 'High': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Medium': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Low': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default: return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/10';
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden glass rounded-[2rem] shadow-soft border-white/10">
      <div className="p-5 md:p-6 border-b border-white/10 shrink-0">
        <div className="flex justify-between items-center mb-5 md:mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-layer-group text-indigo-400 text-base md:text-xl"></i>
            </div>
            <h3 className="font-bold text-lg md:text-xl text-white tracking-tight">Timeline</h3>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onCopy}
              className="text-[10px] md:text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl transition-all flex items-center gap-2 text-white border border-white/10"
            >
              <i className="fa-regular fa-copy"></i> SHARE
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4">
          <div className="relative flex-1">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-3 pr-3 py-2.5 md:pl-4 md:pr-4 md:py-3 bg-black/20 border border-white/10 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm text-white focus:outline-none focus:ring-2 ring-indigo-500/50 transition-all appearance-none"
            />
          </div>
          <div className="px-3 py-2.5 md:px-4 md:py-3 bg-indigo-500/10 rounded-xl md:rounded-2xl border border-indigo-500/20 whitespace-nowrap">
            <span className="text-[10px] md:text-sm font-bold text-indigo-400">
              {pendingCount} Left
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-12 md:py-20 opacity-60">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 md:mb-6 border border-white/10">
              <i className="fa-solid fa-wind text-2xl md:text-3xl text-slate-400"></i>
            </div>
            <p className="font-bold text-base md:text-lg text-white text-center">Empty & Clean</p>
            <p className="text-[10px] md:text-sm text-slate-400 font-medium text-center">Belum ada tugas hari ini.</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <div 
              key={task.id}
              className={`group p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all duration-300 flex items-start gap-3 md:gap-4 ${
                task.status === 'done' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 opacity-70' 
                  : 'bg-white/5 border-white/10 hover:shadow-lg hover:scale-[1.01]'
              }`}
            >
              <button 
                onClick={() => onToggle(task.id)}
                className={`mt-0.5 md:mt-1 w-5 h-5 md:w-6 md:h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                  task.status === 'done' 
                  ? 'bg-emerald-500 border-emerald-500 text-white' 
                  : 'border-slate-600 bg-transparent'
                }`}
              >
                {task.status === 'done' && <i className="fa-solid fa-check text-[10px] md:text-xs"></i>}
              </button>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className={`text-xs md:text-sm font-bold tracking-tight text-white leading-tight ${task.status === 'done' ? 'line-through text-slate-500 opacity-60' : ''}`}>
                    {task.content}
                  </p>
                  {task.priority && task.priority !== 'Normal' && (
                    <span className={`text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  )}
                </div>
              </div>

              <button 
                onClick={() => onDelete(task.id)}
                className="opacity-0 group-hover:opacity-100 md:opacity-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
              >
                <i className="fa-solid fa-trash-can text-xs md:text-sm"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaskList;
