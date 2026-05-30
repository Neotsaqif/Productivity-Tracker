import React from 'react';
import { Task, Achievement, DailyLog } from '../types.js';
import { CheckCircle2, Flame, Award, Calendar, ChevronRight, CheckSquare, ListTodo } from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
  achievements: Achievement[];
  logs: DailyLog[];
  onNavigate: (tab: string) => void;
}

export function Dashboard({ tasks, achievements, logs, onNavigate }: DashboardProps) {
  // 1. Calculate today's date formatted nicely in local time
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate stats
  const activeTasksCount = tasks.filter((t) => !t.completed).length;
  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const totalTasksCount = tasks.length;
  const progressPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Streak Calculation
  // If daily_logs exists for today → +1 streak. If missing day breaks chain → reset.
  // Standard consecutive search lookback logic:
  const getStreak = (): number => {
    if (logs.length === 0) return 0;

    const logDatesSet = new Set(logs.map((l) => l.date));
    
    // Get local date format (YYYY-MM-DD)
    const getLocalDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayDate = new Date();
    const todayKey = getLocalDateString(todayDate);
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(todayDate.getDate() - 1);
    const yesterdayKey = getLocalDateString(yesterdayDate);

    // Initial cursor: if today has a log, start checking from today.
    // If today does not have a log, but yesterday does, start checking from yesterday.
    // Otherwise streak is 0.
    let currentCheckDate = new Date();
    let currentKey = todayKey;

    if (!logDatesSet.has(todayKey)) {
      if (logDatesSet.has(yesterdayKey)) {
        currentCheckDate = yesterdayDate;
        currentKey = yesterdayKey;
      } else {
        return 0;
      }
    }

    let streak = 0;
    while (logDatesSet.has(currentKey)) {
      streak++;
      currentCheckDate.setDate(currentCheckDate.getDate() - 1);
      currentKey = getLocalDateString(currentCheckDate);
    }

    return streak;
  };

  const streak = getStreak();
  const recentAchievements = achievements.slice(0, 5);

  return (
    <div className="space-y-10">
      {/* Top Section: Header & Mission Statement */}
      <div className="bg-white border-2 border-slate-900 rounded-none p-6 md:p-8 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
              <Calendar className="w-4 h-4 text-slate-900" />
              <span>{todayStr} &mdash; FOCUSED MODE</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none text-slate-900">
              Workspace Dashboard
            </h1>
            <p className="text-slate-500 text-sm font-semibold max-w-3xl">
              Current Mission: <span className="text-slate-900 font-extrabold italic">"Execution over planning. Output over noise. Track tasks, log daily check-ins, study reviews."</span>
            </p>
          </div>
          <button
            onClick={() => onNavigate('checkin')}
            className="self-start md:self-center px-5 py-3 bg-slate-900 text-white hover:bg-slate-800 border-2 border-slate-900 rounded-none text-xs font-black uppercase tracking-widest hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-0 active:translate-y-0 hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] shadow-none transition-all duration-150 cursor-pointer shrink-0"
          >
            Submit Daily Log
          </button>
        </div>
      </div>

      {/* Middle Section: Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Streak */}
        <div className="bg-white border-2 border-slate-900 rounded-none p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-start gap-4">
          <div className="p-3 border-2 border-slate-900 bg-orange-500 text-white rounded-none">
            <Flame className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Current Streak</div>
            <div className="text-4xl font-black text-slate-900 mt-1">
              {streak} <span className="text-xs font-bold uppercase tracking-tight text-slate-400">{streak === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Progress Percentage */}
        <div className="bg-white border-2 border-slate-900 rounded-none p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-start gap-4">
          <div className="p-3 border-2 border-slate-900 bg-indigo-600 text-white rounded-none">
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Completion</div>
            <div className="text-4xl font-black text-slate-900 mt-1">
              {progressPercentage}%
            </div>
            {/* Brutalist Flat Progress Bar */}
            <div className="w-full bg-slate-100 border-2 border-slate-900 h-3.5 mt-2 rounded-none overflow-hidden">
              <div 
                className="bg-indigo-600 h-full border-r-2 border-slate-900" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Metric 3: Active Tasks */}
        <div className="bg-white border-2 border-slate-900 rounded-none p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-start gap-4">
          <div className="p-3 border-2 border-slate-900 bg-slate-200 text-slate-900 rounded-none">
            <ListTodo className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Tasks Left</div>
            <div className="text-4xl font-black text-slate-900 mt-1">
              {activeTasksCount} <span className="text-xs font-bold uppercase tracking-tight text-slate-400">/ {totalTasksCount}</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Achievements Count */}
        <div className="bg-white border-2 border-slate-900 rounded-none p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-start gap-4">
          <div className="p-3 border-2 border-slate-900 bg-emerald-500 text-white rounded-none">
            <Award className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Deeds Logged</div>
            <div className="text-4xl font-black text-slate-900 mt-1">
              {achievements.length}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Achievements Row */}
      <div className="bg-white border-2 border-slate-900 rounded-none shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
        <div className="px-6 py-5 border-b-2 border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-slate-900 stroke-[3]" />
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Proof of Work / Recent Achievements</h2>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white border-2 border-slate-900 px-2 py-0.5 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
            Last 5 records
          </span>
        </div>
        
        {recentAchievements.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-4">
            <p className="font-bold text-sm uppercase tracking-wider">No technical accomplishments unlocked yet.</p>
            <p className="text-xs text-slate-400">Complete tasks inside your daily tasks view to automatically generate verifiable proof items!</p>
            <button
              onClick={() => onNavigate('tasks')}
              className="px-4 py-2 bg-white border-2 border-slate-900 hover:bg-slate-900 hover:text-white text-slate-900 text-xs font-black uppercase tracking-widest transition-colors duration-150 cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
            >
              Add Tasks Now &rarr;
            </button>
          </div>
        ) : (
          <div className="divide-y-2 divide-slate-900 p-4 bg-slate-50/50 flex flex-col gap-3">
            {recentAchievements.map((ach) => (
              <div 
                key={ach.id} 
                className="bg-slate-900 text-white text-xs font-bold px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] rounded-none"
              >
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 text-sm">★</span>
                  <span className="font-black uppercase tracking-tight">{ach.text}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {new Date(ach.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
