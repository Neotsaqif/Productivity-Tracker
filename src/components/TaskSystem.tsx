import React, { useState } from 'react';
import { Task } from '../types.js';
import { Plus, Trash2, CheckCircle2, Bookmark, Clock, CheckSquare } from 'lucide-react';

interface TaskSystemProps {
  tasks: Task[];
  onAddTask: (title: string, category: string) => Promise<void>;
  onToggleTask: (id: number) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
}

const POPULAR_CATEGORIES = ['Code', 'Reflections', 'Focus', 'Health', 'Admin', 'Meeting'];

export function TaskSystem({ tasks, onAddTask, onToggleTask, onDeleteTask }: TaskSystemProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Code');
  const [customCategory, setCustomCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed'>('all');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedCategory = category === 'Custom' ? (customCategory.trim() || 'General') : category;

    setIsSubmitting(true);
    try {
      await onAddTask(title.trim(), selectedCategory);
      setTitle('');
      setCustomCategory('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === 'active') return !t.completed;
    if (activeFilter === 'completed') return t.completed;
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Task Creation Section */}
      <div className="bg-white border-2 border-slate-900 rounded-none p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] h-fit">
        <h2 className="text-xl font-black uppercase mb-4 tracking-tight text-slate-900 border-b-2 border-slate-900 pb-2">
          + Create Task
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Task Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Implement Groq AI Reviews..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-none text-sm font-semibold placeholder-slate-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Category Set</label>
            <div className="grid grid-cols-3 gap-2">
              {POPULAR_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`py-2 text-xs uppercase tracking-tight transition-all rounded-none border-2 ${
                    category === cat
                      ? 'border-slate-900 bg-slate-900 text-white font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                      : 'border-slate-200 bg-white text-slate-600 font-bold hover:border-slate-900 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategory('Custom')}
                className={`py-2 col-span-3 text-xs uppercase tracking-tight transition-all rounded-none border-2 ${
                  category === 'Custom'
                    ? 'border-slate-900 bg-slate-900 text-white font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'border-slate-200 bg-white text-slate-600 font-bold hover:border-slate-900 hover:text-slate-900'
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

      {/* Task List Section */}
      <div className="lg:col-span-2 space-y-6">
        {/* Filtering & Count Panel */}
        <div className="bg-white border-2 border-slate-900 rounded-none p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex gap-2 w-full sm:w-auto">
            {(['all', 'active', 'completed'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
                  activeFilter === filter
                    ? 'border-slate-900 bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'border-transparent text-slate-400 hover:text-slate-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            {filteredTasks.length} / {tasks.length} total tasks
          </span>
        </div>

        {/* List of Tasks */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white border-2 border-slate-900 rounded-none p-16 text-center text-slate-400 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <p className="font-bold text-sm uppercase tracking-widest">No matching tasks found.</p>
            <p className="text-xs mt-1">Get started by filling out the creation form on the left.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white border-2 p-4 flex items-center justify-between gap-4 transition-all ${
                  task.completed 
                    ? 'border-slate-200 opacity-70 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.05)]' 
                    : 'border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Complete Checkbox */}
                  <button
                    onClick={() => onToggleTask(task.id)}
                    className={`shrink-0 w-6 h-6 rounded-none border-2 flex items-center justify-center transition-all cursor-pointer ${
                      task.completed
                        ? 'border-slate-900 bg-slate-900 text-white font-black'
                        : 'border-slate-900 bg-white hover:bg-slate-100'
                    }`}
                  >
                    {task.completed && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="min-w-0">
                    <span
                      className={`text-sm font-bold tracking-tight break-all block ${
                        task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </span>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-2 rounded-none ${
                        task.completed 
                          ? 'bg-slate-100 border-slate-300 text-slate-400'
                          : 'bg-indigo-50 border-slate-900 text-indigo-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                      }`}>
                        {task.category}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(task.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteTask(task.id)}
                  title="Delete Task"
                  className="p-2 text-slate-350 hover:text-red-600 hover:bg-red-50 hover:border-red-900 border-2 border-transparent transition-all rounded-none cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
