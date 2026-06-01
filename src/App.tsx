import React, { useState, useEffect } from 'react';
import { Task, Achievement, DailyLog, AIReview, Activity } from './types';
import { Dashboard } from './components/Dashboard';
import { TaskSystem } from './components/TaskSystem';
import { DailyCheckin } from './components/DailyCheckin';
import { ProgressHistory } from './components/ProgressHistory';
import { RoadmapSystem } from './components/RoadmapSystem';
import { Settings } from './components/Settings';
import { LayoutDashboard, CheckSquare, ListTodo, ClipboardList, Clock, Sparkles, RefreshCw, AlertCircle, LayoutTemplate, Settings as SettingsIcon } from 'lucide-react';

type TabType = 'dashboard' | 'tasks' | 'checkin' | 'history' | 'roadmap' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [reviews, setReviews] = useState<AIReview[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch full application history state
  const fetchAllData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/history');
      if (!res.ok) {
        throw new Error(`Server returned HTTP Error Status: ${res.status}`);
      }
      const data = await res.json();
      setTasks(data.tasks || []);
      setAchievements(data.achievements || []);
      setLogs(data.logs || []);
      setReviews(data.reviews || []);
      setActivities(data.activities || []);
    } catch (err: any) {
      console.error('Error load database sync states:', err);
      setErrorMsg(`Failed to synchronize workspace: ${err.message}. Ensure backend is active.`);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Backend state modification hooks
  const handleAddTask = async (title: string, category: string, type?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'scheduled' | 'unscheduled', scheduleDate?: string | null) => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, type, scheduleDate }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to insert task');
      }
      // Refresh
      await fetchAllData(true);
    } catch (err: any) {
      setErrorMsg(err.message);
      throw err;
    }
  };

  const handleToggleTask = async (id: number) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to toggle task');
      }
      await fetchAllData(true);
    } catch (err: any) {
      setErrorMsg(err.message);
      throw err;
    }
  };

  const handleDeleteTask = async (id: number) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete task');
      }
      await fetchAllData(true);
    } catch (err: any) {
      setErrorMsg(err.message);
      throw err;
    }
  };

  const handleSaveCheckin = async (date: string, content: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, content }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to commit check-in log');
      }
      
      const resData = await res.json();
      await fetchAllData(true);
      return resData;
    } catch (err: any) {
      setErrorMsg(err.message);
      throw err;
    }
  };

  const handleTriggerReview = async (date: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to run AI evaluation');
      }
      const data = await res.json();
      await fetchAllData(true);
      return data.review;
    } catch (err: any) {
      setErrorMsg(err.message);
      throw err;
    }
  };

  // Nav items list
  const TABS = [
    { id: 'dashboard', label: 'Today Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Daily Tasks', icon: CheckSquare },
    { id: 'checkin', label: 'Daily Check-In', icon: ClipboardList },
    { id: 'history', label: 'Progress History', icon: Clock },
    { id: 'roadmap', label: 'Project Roadmap', icon: LayoutTemplate },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      {/* Structural Workspace Header */}
      <header className="sticky top-0 z-40 bg-white border-b-2 border-slate-900">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-baseline gap-3">
              {/* Bold black badge logo block */}
              <div className="border-2 border-slate-900 bg-slate-900 text-white w-9 h-9 flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] uppercase select-none">
                P
              </div>
              <div>
                <span className="font-black text-slate-900 text-lg uppercase tracking-tighter sm:inline">Productivity</span>
                <span className="text-[10px] font-black border-2 border-slate-900 bg-indigo-100 text-indigo-900 rounded px-1.5 py-0.5 ml-2 uppercase tracking-widest">
                  MVP v1.0
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAllData(false)}
                title="Refresh Workspace"
                className="p-2 border-2 border-slate-900 bg-white hover:bg-slate-900 hover:text-white transition-colors duration-150 rounded-none shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-[0px_0px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 font-bold" />
              </button>
            </div>
          </div>

          {/* Navigation Tab Menu */}
          <nav className="flex space-x-1 overflow-x-auto pb-1 -mb-[2px]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-black tracking-wider uppercase whitespace-nowrap transition-all border-b-4 cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-slate-900 text-slate-900 bg-slate-100/40'
                      : 'border-transparent text-slate-400 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 stroke-[2.5]" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-10">
        {errorMsg && (
          <div className="mb-8 bg-red-50 border-2 border-slate-900 p-5 rounded-none flex items-start gap-3 text-sm shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-extrabold uppercase tracking-wider text-red-900 block mb-1">System Diagnostic Exception</span>
              <p className="font-semibold text-slate-800">{errorMsg}</p>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs font-bold border border-red-300 px-2 py-1 bg-white hover:bg-red-100 uppercase tracking-wide shrink-0 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-32 text-center space-y-4">
            <RefreshCw className="w-10 h-10 text-slate-900 animate-spin mx-auto stroke-[3]" />
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Syncing database schemas & tables...</p>
          </div>
        ) : (
          <div className="max-w-none">
            {activeTab === 'dashboard' && (
              <Dashboard
                tasks={tasks}
                achievements={achievements}
                logs={logs}
                activities={activities}
                reviews={reviews}
                onNavigate={(tab) => setActiveTab(tab as TabType)}
              />
            )}

            {activeTab === 'tasks' && (
              <TaskSystem
                tasks={tasks}
                onAddTask={handleAddTask}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
              />
            )}

            {activeTab === 'checkin' && (
              <DailyCheckin
                logs={logs}
                reviews={reviews}
                onSaveCheckin={handleSaveCheckin}
                onTriggerReview={handleTriggerReview}
              />
            )}

            {activeTab === 'history' && (
              <ProgressHistory
                logs={logs}
                reviews={reviews}
                achievements={achievements}
                activities={activities}
              />
            )}

            {activeTab === 'roadmap' && (
              <RoadmapSystem />
            )}

            {activeTab === 'settings' && (
              <Settings onRefresh={() => fetchAllData(true)} />
            )}
          </div>
        )}
      </main>

      {/* Humble Footer */}
      <footer className="bg-white border-t-2 border-slate-900 py-6 text-center shadow-[0_-4px_0px_0px_rgba(15,23,42,0.05)]">
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.25em]">
          EXECUTION WORKTRACKER &mdash; BUILT TO REFLECT TRUTH
        </p>
      </footer>
    </div>
  );
}
