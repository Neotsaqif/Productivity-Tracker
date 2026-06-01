import React from 'react';
import { Task, Achievement, DailyLog, Activity, AIReview } from '../types';
import { CheckCircle2, Flame, Award, Calendar, ChevronRight, CheckSquare, ListTodo, MapPin, Milestone, Star, Sparkles } from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
  achievements: Achievement[];
  logs: DailyLog[];
  activities: Activity[];
  reviews: AIReview[];
  onNavigate: (tab: string) => void;
}

export function Dashboard({ tasks, achievements, logs, activities, reviews, onNavigate }: DashboardProps) {
  // Today's Date formatted nicely
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate Tasks Stats
  const activeTasksCount = tasks.filter((t) => !t.completed).length;
  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const totalTasksCount = tasks.length;
  const progressPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Streak Calculation
  const getStreak = (): number => {
    if (logs.length === 0) return 0;
    const logDatesSet = new Set(logs.map((l) => l.date));
    
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

  // Roadmap activities stats
  const roadmapActivities = (activities || []).filter(
    (a) => a.type === 'roadmap_step_completed' || a.type === 'roadmap_project_completed'
  );
  const completedStepsCount = (activities || []).filter((a) => a.type === 'roadmap_step_completed').length;
  const completedProjectsCount = (activities || []).filter((a) => a.type === 'roadmap_project_completed').length;
  const recentRoadmapMilestones = roadmapActivities.slice(0, 4);

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

      {/* Dynamic Daily Score + Bonus Score Panel */}
      {(() => {
        const todayKey = new Date().toISOString().split('T')[0];
        const todayReview = (reviews || []).find(r => r.date === todayKey);
        const latestReview = todayReview || (reviews && reviews.length > 0 ? [...reviews].sort((a,b) => b.date.localeCompare(a.date))[0] : null);

        const dailyTasks = tasks.filter(t => {
          return t.type === 'daily' || (t.type === 'scheduled' && t.scheduleDate === todayKey);
        });
        const dailyTasksTotal = dailyTasks.length;
        const dailyTasksCompleted = dailyTasks.filter(t => t.completed && t.completedAt && t.completedAt.startsWith(todayKey)).length;

        const weeklyCompletedToday = tasks.filter(t => t.type === 'weekly' && t.completed && t.completedAt && t.completedAt.startsWith(todayKey));
        const monthlyCompletedToday = tasks.filter(t => t.type === 'monthly' && t.completed && t.completedAt && t.completedAt.startsWith(todayKey));
        const yearlyCompletedToday = tasks.filter(t => t.type === 'yearly' && t.completed && t.completedAt && t.completedAt.startsWith(todayKey));
        const completedRoadmapSteps = (activities || []).filter(act => act.type === 'roadmap_step_completed' && act.createdAt && act.createdAt.startsWith(todayKey));
        const completedRoadmapProjects = (activities || []).filter(act => act.type === 'roadmap_project_completed' && act.createdAt && act.createdAt.startsWith(todayKey));
        const scheduledCompletedEarly = tasks.filter(t => {
          return t.type === 'scheduled' && 
                 t.completed && 
                 t.completedAt && 
                 t.completedAt.startsWith(todayKey) && 
                 t.scheduleDate && 
                 t.scheduleDate > todayKey;
        });

        const bonusItems = [
          { label: 'Weekly Goal Done', count: weeklyCompletedToday.length, points: '+0.5' },
          { label: 'Monthly Goal Done', count: monthlyCompletedToday.length, points: '+1.0' },
          { label: 'Yearly Goal Done', count: yearlyCompletedToday.length, points: '+2.0' },
          { label: 'Roadmap Step Done', count: completedRoadmapSteps.length, points: '+0.5' },
          { label: 'Roadmap Project Done', count: completedRoadmapProjects.length, points: '+1.0' },
          { label: 'Scheduled Task Early', count: scheduledCompletedEarly.length, points: '+0.5' },
        ].filter(item => item.count > 0);

        return (
          <div className="bg-slate-900 text-white border-2 border-slate-900 rounded-none p-6 md:p-8 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Panel 1: Primary Daily Score */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-indigo-400">
                <Sparkles className="w-4 h-4 text-indigo-400 fill-indigo-400" />
                <span>Today's Daily Audit</span>
              </div>
              
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tighter">
                  {latestReview ? latestReview.score.toFixed(1) : '---'}
                </span>
                <span className="text-slate-400 text-sm font-black uppercase">/ 10 Score</span>
              </div>

              <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                {latestReview 
                  ? `Calculated on ${latestReview.date}. Focuses purely on daily tasks and log reflections.`
                  : 'Write a daily check-in and request an AI audit to calculate your performance index.'}
              </p>
              
              {/* Progress bar of Daily task completion */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Today's Due Progress</span>
                  <span>{dailyTasksCompleted} / {dailyTasksTotal} Tasks</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-none border border-slate-700 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full" 
                    style={{ width: `${dailyTasksTotal > 0 ? (dailyTasksCompleted / dailyTasksTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Panel 2: Bonus Progress Score */}
            <div className="space-y-4 border-t-2 border-slate-800 md:border-t-0 md:border-l-2 md:border-r-2 md:px-8 border-dashed border-slate-700">
              <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-emerald-400">
                <Star className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                <span>Bonus Achievements</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-emerald-400 tracking-tighter">
                  +{latestReview && typeof latestReview.bonusScore === 'number' ? latestReview.bonusScore.toFixed(1) : '0.0'}
                </span>
                <span className="text-slate-400 text-sm font-black uppercase">Extra Progress</span>
              </div>

              <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                Measures strategic weekly/monthly goals, roadmap projects, and early completions. Cap: +5.0 maximum.
              </p>

              <button 
                onClick={() => onNavigate('checkin')}
                className="flex items-center gap-1.5 text-xs text-white hover:text-indigo-400 font-extrabold pb-0.5 border-b border-white hover:border-indigo-400 uppercase tracking-widest transition-colors cursor-pointer"
              >
                Go to Daily Log Review &rarr;
              </button>
            </div>

            {/* Panel 3: Today's Verified Accomplishments Feed */}
            <div className="space-y-4">
              <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                Today's Verified Events
              </div>

              {bonusItems.length === 0 ? (
                <div className="bg-slate-950 p-4 border border-slate-800 flex items-center justify-center text-center h-[120px]">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider italic">
                    No extra goals completed today. Complete a Weekly, Monthly, or Roadmap task to earn dynamic bonus points!
                  </p>
                </div>
              ) : (
                <div className="space-y-2 h-[120px] overflow-y-auto pr-1">
                  {bonusItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-950 p-2.5 border border-slate-800 shadow-[1px_1px_0px_0px_rgba(255,255,255,0.1)]">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-xs font-black">✓</span>
                        <span className="text-xs text-slate-300 font-black uppercase tracking-tight">{item.label}</span>
                      </div>
                      <span className="text-[10px] font-black px-1.5 py-0.5 bg-emerald-950 border border-emerald-900 text-emerald-400">
                        {item.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        );
      })()}

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
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Task Completion</div>
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

      {/* ROADMAP STATISTICS SECTION (NEW!) */}
      <div className="bg-white border-2 border-slate-900 rounded-none shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] p-6 space-y-6">
        <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Milestone className="w-5 h-5 text-slate-900 stroke-[2.5]" />
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">🧭 Strategic Roadmap Performance</h2>
          </div>
          <button
            onClick={() => onNavigate('roadmap')}
            className="text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-3 py-1 uppercase tracking-wider rounded-none cursor-pointer"
          >
            Manage Roadmaps &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Completed Steps */}
          <div className="bg-sky-50/50 border-2 border-sky-950 p-5 rounded-none flex items-center gap-4">
            <div className="p-3 bg-sky-200 border border-sky-400 text-sky-900 rounded-none">
              <CheckSquare className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-600">Roadmap Steps Completed</div>
              <div className="text-3xl font-black text-sky-950 mt-1">{completedStepsCount}</div>
            </div>
          </div>

          {/* Card 2: Completed Projects */}
          <div className="bg-emerald-50/50 border-2 border-emerald-950 p-5 rounded-none flex items-center gap-4">
            <div className="p-3 bg-emerald-200 border border-emerald-400 text-emerald-900 rounded-none">
              <MapPin className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Roadmaps Accomplished</div>
              <div className="text-3xl font-black text-emerald-950 mt-1">{completedProjectsCount}</div>
            </div>
          </div>

          {/* Card 3: Combined Roadmap Achievements count */}
          <div className="bg-slate-50 border-2 border-slate-900 p-5 rounded-none flex items-center gap-4">
            <div className="p-3 bg-slate-200 border border-slate-400 text-slate-900 rounded-none">
              <Award className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Roadmap Activity Records</div>
              <div className="text-3xl font-black text-slate-900 mt-1">{roadmapActivities.length}</div>
            </div>
          </div>
        </div>

        {/* Milestone feed */}
        <div className="space-y-3 pt-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verifiable Milestone Actions:</div>
          {recentRoadmapMilestones.length === 0 ? (
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider italic bg-slate-50 border border-slate-200 p-4 text-center">
              No milestones completed yet. Check off items in the Roadmaps tabs to unlock real strategic achievements!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentRoadmapMilestones.map((milestone) => {
                const isProject = milestone.type === 'roadmap_project_completed';
                return (
                  <div 
                    key={milestone.id}
                    className={`border-2 p-3.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between ${
                      isProject 
                        ? 'border-emerald-900 bg-emerald-50 text-emerald-950' 
                        : 'border-sky-900 bg-sky-50 text-sky-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-xs font-black leading-tight">{milestone.title}</span>
                      <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 border ${
                        isProject 
                          ? 'border-emerald-400 bg-emerald-200 text-emerald-800' 
                          : 'border-sky-400 bg-sky-200 text-sky-800'
                      }`}>
                        {isProject ? 'Roadmap Finished' : 'Step Complete'}
                      </span>
                    </div>
                    <span className="text-[8px] font-extrabold text-slate-400 mt-2 uppercase tracking-wider">
                      {new Date(milestone.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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
