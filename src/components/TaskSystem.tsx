import React, { useState } from 'react';
import { Task } from '../types.js';
import { Plus, Trash2, Clock, Calendar, CheckSquare, ListTodo, Archive } from 'lucide-react';

interface TaskSystemProps {
  tasks: Task[];
  onAddTask: (
    title: string,
    category: string,
    type?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'scheduled' | 'unscheduled',
    scheduleDate?: string | null
  ) => Promise<void>;
  onToggleTask: (id: number) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
}

const POPULAR_CATEGORIES = ['Daily', 'School', 'Hobby', 'Skills', 'Reflections', 'Health'];

export function TaskSystem({ tasks, onAddTask, onToggleTask, onDeleteTask }: TaskSystemProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('School');
  const [customCategory, setCustomCategory] = useState('');
  const [type, setType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'scheduled' | 'unscheduled'>('daily');
  
  // Default to today's date in local format YYYY-MM-DD
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [scheduleDate, setScheduleDate] = useState(getTodayString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Custom scope filters as specified by user visibility logic
  const [activeView, setActiveView] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'scheduled' | 'unscheduled' | 'history'>('all');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedCategory = category === 'Custom' ? (customCategory.trim() || 'General') : category;
    const finalScheduleDate = type === 'scheduled' ? scheduleDate : null;

    setIsSubmitting(true);
    try {
      await onAddTask(title.trim(), selectedCategory, type, finalScheduleDate);
      setTitle('');
      setCustomCategory('');
      // Keep type and category as is for easier double creations
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = getTodayString();

  // Filter tasks based on active scope view
  const filteredTasks = tasks.filter((t) => {
    const status = t.status || 'active';

    if (activeView === 'history') {
      return status === 'completed' || status === 'missed';
    }

    // Active views only show active status tasks
    if (status !== 'active') {
      return false;
    }

    // Unscheduled tasks are always visible in any active view except for specific filters
    const isUnscheduled = t.type === 'unscheduled';

    switch (activeView) {
      case 'all':
        return true;

      case 'today':
        return t.type === 'daily' || (t.type === 'scheduled' && t.scheduleDate === todayStr) || isUnscheduled;
      
      case 'week':
        return t.type === 'weekly' || isUnscheduled;
      
      case 'month':
        return t.type === 'monthly' || isUnscheduled;
      
      case 'year':
        return t.type === 'yearly' || isUnscheduled;
      
      case 'scheduled':
        return t.type === 'scheduled';
      
      case 'unscheduled':
        return isUnscheduled;
      
      default:
        return true;
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Sidebar: Task Creator Form */}
      <div className="bg-white border-2 border-slate-900 rounded-none p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] h-fit">
        <h2 className="text-xl font-black uppercase mb-4 tracking-tight text-slate-900 border-b-2 border-slate-900 pb-2">
          + Create Task
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Task Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Code database schema migrations..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-none text-sm font-semibold placeholder-slate-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all"
            />
          </div>

           {/* Scope selection */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Task Scope (Type)</label>
            <div className="grid grid-cols-3 gap-2">
              {(['daily', 'weekly', 'monthly', 'yearly', 'scheduled', 'unscheduled'] as const).map((tScope) => (
                <button
                  type="button"
                  key={tScope}
                  onClick={() => setType(tScope)}
                  className={`py-2 text-[10px] font-bold uppercase tracking-tighter transition-all rounded-none border-2 ${
                    type === tScope
                      ? 'border-slate-900 bg-slate-900 text-white font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-900'
                  }`}
                >
                  {tScope}
                </button>
              ))}
            </div>
          </div>

          {/* Scheduled Date picker option */}
          {type === 'scheduled' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Schedule Specific Date</label>
              <input
                type="date"
                required
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-none text-sm font-semibold focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all"
              />
            </div>
          )}

          {/* Categories */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Category Set</label>
            <div className="grid grid-cols-3 gap-2">
              {POPULAR_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`py-2 text-[10px] uppercase font-bold tracking-tight transition-all rounded-none border-2 ${
                    category === cat
                      ? 'border-slate-900 bg-slate-900 text-white font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategory('Custom')}
                className={`py-2 col-span-3 text-xs uppercase tracking-tight font-bold transition-all rounded-none border-2 ${
                  category === 'Custom'
                    ? 'border-slate-900 bg-slate-900 text-white font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-900'
                }`}
              >
                Custom Category...
              </button>
            </div>
          </div>

          {category === 'Custom' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Custom Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Design, DevOps..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-none text-sm font-semibold placeholder-slate-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="w-full py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-none border-2 border-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 transition-all pointer-cursor flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Task</span>
          </button>
        </form>
      </div>

       {/* Right Column: Interactive Multi-Scope task dashboard views */}
      <div className="lg:col-span-2 space-y-6">
        {/* Navigation views board */}
        <div className="bg-white border-2 border-slate-900 rounded-none p-2 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <div className="grid grid-cols-3 sm:grid-cols-8 gap-1">
            {[
              { id: 'all', label: '🗂️ All Tasks', desc: 'All active responsibilities' },
              { id: 'today', label: '📅 Today', desc: 'Daily Focus' },
              { id: 'week', label: '📆 Weekly', desc: 'Weekly Focus' },
              { id: 'month', label: '🗓️ Monthly', desc: 'Monthly Focus' },
              { id: 'year', label: '🌟 Yearly', desc: 'Yearly Focus' },
              { id: 'scheduled', label: '⏰ Scheduled', desc: `Scheduled Tasks` },
              { id: 'unscheduled', label: '📋 Unscheduled', desc: `Unscheduled Tasks` },
              { id: 'history', label: '📜 History', desc: 'Completed Archive' }
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveView(v.id as any)}
                title={v.desc}
                className={`flex flex-col items-center justify-center py-2.5 px-1 border-2 transition-all cursor-pointer ${
                  activeView === v.id
                    ? 'border-slate-900 bg-slate-900 text-white font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200'
                }`}
              >
                <span className="text-xs font-black tracking-tight">{v.label}</span>
                <span className={`text-[8px] uppercase tracking-tighter ${activeView === v.id ? 'text-slate-300' : 'text-slate-400'}`}>
                  {v.id === 'scheduled' ? `active/future` : v.id === 'history' ? 'completed' : v.id === 'unscheduled' ? 'no due date' : 'view'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* View title + task statistics */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2">
              {activeView === 'all' && 'ALL ACTIVE TASKS'}
              {activeView === 'today' && 'TODAY ACTIVE DAILY TASKS'}
              {activeView === 'week' && 'THIS WEEK TRACKED TASKS'}
              {activeView === 'month' && 'THIS MONTH SCOPE'}
              {activeView === 'year' && 'THIS YEAR SCOPE'}
              {activeView === 'scheduled' && 'ACTIVE AND FUTURE SCHEDULED TASKS'}
              {activeView === 'unscheduled' && 'UNSCHEDULED BACKLOG TASKS'}
              {activeView === 'history' && 'COMPLETED TASK ARCHIVE'}
            </h3>
            <p className="text-xs text-slate-400 font-semibold uppercase mt-0.5">
              {activeView === 'all' && 'Type: All Active Scopes (Daily, Weekly, Monthly, Yearly, Scheduled, Unscheduled)'}
              {activeView === 'today' && 'Type: Daily Only'}
              {activeView === 'week' && 'Type: Weekly Only'}
              {activeView === 'month' && 'Type: Monthly Only'}
              {activeView === 'year' && 'Type: Yearly Only'}
              {activeView === 'scheduled' && `Scheduled today or later (due >= ${todayStr}, hidden if late)`}
              {activeView === 'unscheduled' && 'Unscheduled tasks with no concrete due dates'}
              {activeView === 'history' && 'Audit trail of completed outputs'}
            </p>
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-100 border-2 border-slate-200 px-2 py-1">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {/* List of Tasks */}
        {(() => {
          const renderTaskCard = (task: Task) => {
            const status = task.status || 'active';
            const isCompleted = task.completed || status === 'completed';
            const isMissed = status === 'missed';
            const isArchived = status === 'completed' || status === 'missed';

            return (
              <div
                key={task.id}
                className={`bg-white border-2 p-4 flex items-center justify-between gap-4 transition-all ${
                  isCompleted
                    ? 'border-slate-200 opacity-70 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.05)]'
                    : isMissed
                    ? 'border-red-350 bg-red-50/10 opacity-80 shadow-[2px_2px_0px_0px_rgba(239,68,68,0.1)]'
                    : 'border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {/* Complete Checkbox */}
                  <button
                    disabled={isArchived}
                    onClick={() => onToggleTask(task.id)}
                    className={`shrink-0 w-6 h-6 rounded-none border-2 flex items-center justify-center transition-all ${
                      isArchived
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50'
                        : 'cursor-pointer border-slate-900 bg-white hover:bg-slate-100'
                    } ${
                      isCompleted && !isMissed
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : ''
                    }`}
                  >
                    {isCompleted && (
                      <svg className="w-3.5 h-3.5 text-white animate-fade-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isMissed && (
                      <span className="text-red-600 text-xs font-black select-none leading-none">×</span>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-sm font-bold tracking-tight break-all block ${
                        isCompleted
                          ? 'line-through text-slate-400 font-medium'
                          : isMissed
                          ? 'line-through text-red-400 font-semibold'
                          : 'text-slate-900'
                      }`}
                    >
                      {/* Required output format: [TYPE] Task Title */}
                      <span className="text-indigo-600 font-extrabold mr-1.5 uppercase">
                        [{task.type || 'daily'}]
                      </span>
                      {task.title}
                    </span>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {/* Required output status display */}
                      <span className="text-[9px] font-black uppercase tracking-wider">
                        Status:{' '}
                        <span
                          className={
                            isCompleted
                              ? 'text-emerald-600 font-extrabold'
                              : isMissed
                              ? 'text-red-600 font-extrabold'
                              : 'text-indigo-600 font-extrabold'
                          }
                        >
                          {isCompleted ? 'Completed' : isMissed ? 'Missed (Expired)' : 'Active'}
                        </span>
                      </span>

                      {/* Required display for scheduled tasks: Due: YYYY-MM-DD */}
                      {task.type === 'scheduled' && task.scheduleDate && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 border border-amber-300">
                          <Calendar className="w-3 h-3" />
                          Due: {task.scheduleDate}
                        </span>
                      )}

                      {/* Display cycle ranges */}
                      {task.cycleStart && task.cycleEnd && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-tight bg-slate-50 border border-slate-200 px-1.5 py-0.5">
                          Cycle: {task.cycleStart} → {task.cycleEnd}
                        </span>
                      )}

                      <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-2 rounded-none bg-slate-50 border-slate-950 text-slate-900">
                        {task.category}
                      </span>

                      <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <Clock className="w-3 h-3 text-slate-300" />
                        Added: {new Date(task.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>

                      {task.completed && task.completedAt && (
                        <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                          Done: {new Date(task.completedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    title="Delete Task"
                    className="p-2 text-slate-350 hover:text-red-600 hover:bg-red-50 hover:border-red-900 border-2 border-transparent transition-all rounded-none cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          };

          if (filteredTasks.length === 0) {
            return (
              <div className="bg-white border-2 border-slate-900 rounded-none p-16 text-center text-slate-400 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <CheckSquare className="w-12 h-12 mx-auto stroke-[1.5] text-slate-300 mb-3" />
                <p className="font-bold text-sm uppercase tracking-widest text-slate-900">No active tasks in this scope.</p>
                <p className="text-xs mt-1">Excellent! All items are either handled, scheduled elsewise, or ready to be created.</p>
              </div>
            );
          }

          if (activeView === 'all') {
            const scopeDefinitions = [
              { id: 'daily', label: '☀️ Daily tasks' },
              { id: 'weekly', label: '📅 Weekly tasks' },
              { id: 'monthly', label: '🗓️ Monthly tasks' },
              { id: 'yearly', label: '🌟 Yearly tasks' },
              { id: 'scheduled', label: '⏰ Scheduled tasks' },
              { id: 'unscheduled', label: '📋 Unscheduled tasks' },
            ] as const;

            return (
              <div className="space-y-8">
                {scopeDefinitions.map((scope) => {
                  const scopeTasks = filteredTasks.filter((t) => t.type === scope.id);
                  if (scopeTasks.length === 0) return null;
                  return (
                    <div key={scope.id} className="space-y-4">
                      <div className="border-b-4 border-slate-900 pb-2 flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest bg-slate-900 text-white px-3 py-1 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                          {scope.label}
                        </h4>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {scopeTasks.length} active {scopeTasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                      </div>
                      <div className="space-y-4">
                        {scopeTasks.map(renderTaskCard)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          return (
            <div className="space-y-4">
              {filteredTasks.map(renderTaskCard)}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
