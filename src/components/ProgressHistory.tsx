import React from 'react';
import { Task, Achievement, DailyLog, AIReview, Activity } from '../types';
import { Calendar, Award, Sparkles, AlertCircle, TrendingUp, Clock, Check, Star } from 'lucide-react';

interface ProgressHistoryProps {
  logs: DailyLog[];
  reviews: AIReview[];
  achievements: Achievement[];
  activities: Activity[];
}

export function ProgressHistory({ logs, reviews, achievements, activities }: ProgressHistoryProps) {
  // We want to group all historical occurrences by date key (YYYY-MM-DD)
  // These occurrences include: Log entered, AI review finished, achievements unlocked, activities completed
  
  const getLocalDateString = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  // Compile unique list of dates in descending order
  const dateMap: {
    [date: string]: {
      log?: DailyLog;
      review?: AIReview;
      achievementsList: Achievement[];
      activitiesList: Activity[];
    };
  } = {};

  // 1. Process Logs
  logs.forEach((log) => {
    if (!dateMap[log.date]) {
      dateMap[log.date] = { achievementsList: [], activitiesList: [] };
    }
    dateMap[log.date].log = log;
  });

  // 2. Process Reviews
  reviews.forEach((rev) => {
    if (!dateMap[rev.date]) {
      dateMap[rev.date] = { achievementsList: [], activitiesList: [] };
    }
    dateMap[rev.date].review = rev;
  });

  // 3. Process Achievements (grouped by local formatted date of createdAt)
  achievements.forEach((ach) => {
    const localDate = getLocalDateString(ach.createdAt);
    if (localDate) {
      if (!dateMap[localDate]) {
        dateMap[localDate] = { achievementsList: [], activitiesList: [] };
      }
      dateMap[localDate].achievementsList.push(ach);
    }
  });

  // 4. Process Activities
  activities?.forEach((act) => {
    const localDate = getLocalDateString(act.createdAt);
    if (localDate) {
      if (!dateMap[localDate]) {
        dateMap[localDate] = { achievementsList: [], activitiesList: [] };
      }
      dateMap[localDate].activitiesList.push(act);
    }
  });

  const sortedDates = Object.keys(dateMap).sort((a, b) => b.localeCompare(a));

  const formatHeaderDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const renderReviewMarkdownInline = (text: string) => {
    return text.split('\n').map((line, index) => {
      if (line.startsWith('### ')) {
        return <h5 key={index} className="text-[11px] font-black text-indigo-950 uppercase mt-3 mb-1">{line.replace('### ', '')}</h5>;
      }
      if (line.startsWith('- ')) {
        return (
          <div key={index} className="text-[11px] text-indigo-900 font-bold flex items-start gap-1 mb-1">
            <span className="text-orange-500 shrink-0">•</span>
            <span>{line.replace('- ', '')}</span>
          </div>
        );
      }
      if (line.trim().length === 0) return null;
      return <p key={index} className="text-[11px] text-indigo-900/90 font-semibold leading-relaxed mb-1">{line}</p>;
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border-2 border-slate-900 rounded-none p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 border-b-2 border-slate-900 pb-2">
          🕒 Logged Progress Timeline
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wide">
          Historical record of daily entries, activities verified by system audit, achievements unlocked, and unbiased AI assessments.
        </p>
      </div>

      {sortedDates.length === 0 ? (
        <div className="bg-white border-2 border-slate-900 rounded-none p-16 text-center text-slate-400 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
          <Calendar className="w-12 h-12 text-slate-900 mx-auto mb-3 stroke-[2.5]" />
          <p className="font-extrabold text-sm uppercase tracking-widest">Your timeline list is currently empty.</p>
          <p className="text-xs mt-1">Execute active tasks and submit logs inside the Daily Check-in view.</p>
        </div>
      ) : (
        <div className="relative border-l-4 border-slate-900 pl-8 ml-6 space-y-12">
          {sortedDates.map((dateKey) => {
            const data = dateMap[dateKey];
            const hasReview = !!data.review;
            const score = data.review?.score;
            
            // Get score color styling for brutalist pills
            let scoreBg = 'bg-slate-100 text-slate-700';
            if (score && score >= 8) scoreBg = 'bg-emerald-500 text-white border-emerald-700';
            else if (score && score >= 5) scoreBg = 'bg-indigo-600 text-white border-indigo-800';
            else if (score) scoreBg = 'bg-orange-500 text-white border-orange-700';

            return (
              <div key={dateKey} className="relative group">
                {/* Visual Brutalist Timeline Square Bullet */}
                <div className="absolute -left-[44px] top-1 w-5 h-5 bg-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"></div>

                <div className="space-y-4">
                  {/* Date Heading & Pill Column */}
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight leading-none">
                      {formatHeaderDate(dateKey)}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white border-2 border-slate-900 px-3 py-0.5 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] rounded-none">
                        {dateKey}
                      </span>
                      {hasReview && (
                        <span className={`text-[10px] font-black uppercase tracking-wider border-2 border-slate-900 px-2 py-0.5 rounded-none shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] ${scoreBg}`}>
                          AI Score: {score}/10
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Daily Log content if exists */}
                  {data.log && (
                    <div className="bg-white border-2 border-slate-900 rounded-none p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] max-w-4xl">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-2">Daily Writeup</div>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap select-text italic">
                        "{data.log.content}"
                      </p>
                    </div>
                  )}

                  {/* Activities, Achievements, and AI diagnostic row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
                    
                    {/* Columns 1: Activities (New!) */}
                    <div className="bg-white border-2 border-slate-900 rounded-none p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                        <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />
                        <span>Work Completed ({data.activitiesList.length})</span>
                      </div>
                      
                      {data.activitiesList.length === 0 ? (
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider italic">No activities recorded for this day.</p>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {data.activitiesList.map((act) => {
                            let typeLabel = 'Task';
                            let badgeColor = 'bg-slate-100 text-slate-700 text-[8px]';
                            if (act.type === 'roadmap_step_completed') {
                              typeLabel = 'Step';
                              badgeColor = 'bg-sky-100 text-sky-800 text-[8px]';
                            } else if (act.type === 'roadmap_project_completed') {
                              typeLabel = 'Roadmap';
                              badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300 text-[8px]';
                            }
                            return (
                              <div key={act.id} className="flex flex-col gap-0.5 border-l-2 border-slate-900 pl-2 py-[2px]">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-extrabold uppercase px-1 py-[1px] border border-slate-900 rounded-none ${badgeColor}`}>
                                    {typeLabel}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-800 font-bold leading-tight">{act.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Columns 2: Achievements Column */}
                    <div className="bg-white border-2 border-slate-900 rounded-none p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                        <Award className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />
                        <span>Achievements ({data.achievementsList.length})</span>
                      </div>
                      
                      {data.achievementsList.length === 0 ? (
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider italic">No achievements unlocked.</p>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {data.achievementsList.map((ach) => (
                            <div key={ach.id} className="flex items-start gap-2 border-l-2 border-amber-400 pl-2 py-0.5">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0 mt-[1px]" />
                              <span className="text-xs text-slate-800 font-bold leading-tight">{ach.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Columns 3: AI Score card */}
                    <div className="bg-indigo-50 border-2 border-indigo-900 text-indigo-950 rounded-none p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400 border-b border-indigo-200 pb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-900 stroke-[2.5]" />
                          <span>AI Evaluation Summary</span>
                        </span>
                      </div>

                      {data.review ? (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {renderReviewMarkdownInline(data.review.summary)}
                        </div>
                      ) : (
                        <div className="text-indigo-400 text-xs py-10 text-center font-bold uppercase tracking-wider italic">
                          No audit stored.
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
