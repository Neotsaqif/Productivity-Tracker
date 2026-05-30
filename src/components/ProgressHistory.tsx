import React from 'react';
import { Task, Achievement, DailyLog, AIReview } from '../types.js';
import { Calendar, Award, Sparkles, AlertCircle, TrendingUp, Clock, Check } from 'lucide-react';

interface ProgressHistoryProps {
  logs: DailyLog[];
  reviews: AIReview[];
  achievements: Achievement[];
}

export function ProgressHistory({ logs, reviews, achievements }: ProgressHistoryProps) {
  // We want to group all historical occurrences by date key (YYYY-MM-DD)
  // These occurances include: Log entered, AI review finished, achievements unlocked
  
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
    };
  } = {};

  // 1. Process Logs
  logs.forEach((log) => {
    if (!dateMap[log.date]) {
      dateMap[log.date] = { achievementsList: [] };
    }
    dateMap[log.date].log = log;
  });

  // 2. Process Reviews
  reviews.forEach((rev) => {
    if (!dateMap[rev.date]) {
      dateMap[rev.date] = { achievementsList: [] };
    }
    dateMap[rev.date].review = rev;
  });

  // 3. Process Achievements (grouped by local formatted date of createdAt)
  achievements.forEach((ach) => {
    const localDate = getLocalDateString(ach.createdAt);
    if (localDate) {
      if (!dateMap[localDate]) {
        dateMap[localDate] = { achievementsList: [] };
      }
      dateMap[localDate].achievementsList.push(ach);
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
          Historical record of daily entries, achievements completed, and unbiased AI performance diagnostics.
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
            return (
              <div key={dateKey} className="relative group">
                {/* Visual Brutalist Timeline Square Bullet */}
                <div className="absolute -left-[44px] top-1 w-5 h-5 bg-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"></div>

                <div className="space-y-4">
                  {/* Date Heading */}
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight leading-none">
                      {formatHeaderDate(dateKey)}
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white border-2 border-slate-900 px-3 py-0.5 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] rounded-none">
                      {dateKey}
                    </span>
                  </div>

                  {/* Daily Log content if exists */}
                  {data.log && (
                    <div className="bg-white border-2 border-slate-900 rounded-none p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] max-w-3xl">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-2">Daily Writeup</div>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap select-text italic">
                        "{data.log.content}"
                      </p>
                    </div>
                  )}

                  {/* Achievements and AI diagnostic row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                    {/* Achievements Column */}
                    <div className="bg-white border-2 border-slate-900 rounded-none p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                        <Award className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />
                        <span>Completed Deeds ({data.achievementsList.length})</span>
                      </div>
                      
                      {data.achievementsList.length === 0 ? (
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider italic">No deeds recorded for this day.</p>
                      ) : (
                        <div className="space-y-2">
                          {data.achievementsList.map((ach) => (
                            <div key={ach.id} className="flex items-start gap-2.5 mt-1">
                              <div className="w-2.5 h-2.5 bg-slate-900 shrink-0 mt-1"></div>
                              <span className="text-xs text-slate-800 font-bold leading-normal">{ach.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AI Score card */}
                    <div className="bg-indigo-50 border-2 border-indigo-900 text-indigo-950 rounded-none p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400 border-b border-indigo-200 pb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-900 stroke-[2.5]" />
                          <span>AI Evaluation</span>
                        </span>
                        {data.review && (
                          <span className="px-2 py-0.5 bg-indigo-900 text-white rounded-none border border-indigo-950 font-black text-[9px] tracking-widest">
                            {data.review.score}/10
                          </span>
                        )}
                      </div>

                      {data.review ? (
                        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                          {renderReviewMarkdownInline(data.review.summary)}
                        </div>
                      ) : (
                        <div className="text-indigo-400 text-xs py-4 text-center font-bold uppercase tracking-wider italic">
                          No audit stored for this checkin.
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
