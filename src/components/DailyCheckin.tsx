import React, { useState, useEffect } from 'react';
import { DailyLog, AIReview } from '../types.js';
import { Calendar, Send, Sparkles, Smile, RefreshCw, AlertCircle, TrendingUp, CheckCircle } from 'lucide-react';

interface DailyCheckinProps {
  logs: DailyLog[];
  reviews: AIReview[];
  onSaveCheckin: (date: string, content: string) => Promise<{ success: boolean; log: DailyLog; review?: AIReview; aiError?: string }>;
  onTriggerReview: (date: string) => Promise<AIReview>;
}

// Function to format Date safely to YYYY-MM-DD
function getLocalDateString(d: Date = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DailyCheckin({ logs, reviews, onSaveCheckin, onTriggerReview }: DailyCheckinProps) {
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load existing log for the selected date on load or date change
  useEffect(() => {
    const log = logs.find((l) => l.date === selectedDate);
    if (log) {
      setContent(log.content);
    } else {
      setContent('');
    }
    setFeedback(null);
  }, [selectedDate, logs]);

  const existingReview = reviews.find((r) => r.date === selectedDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await onSaveCheckin(selectedDate, content.trim());
      if (res.success) {
        if (res.aiError) {
          setFeedback({
            type: 'success',
            message: `Check-in saved, but AI Review is pending: ${res.aiError}`,
          });
        } else {
          setFeedback({
            type: 'success',
            message: 'Check-in saved and AI Daily Review generated successfully!',
          });
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to submit check-in',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualReview = async () => {
    if (!content.trim()) {
      setFeedback({ type: 'error', message: 'Please write a daily check-in log first before generating a review.' });
      return;
    }

    setIsReviewing(true);
    setFeedback(null);
    try {
      await onTriggerReview(selectedDate);
      setFeedback({
        type: 'success',
        message: 'AI Daily Review completed and stored successfully.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'AI review evaluation failed. Verify API configuration.',
      });
    } finally {
      setIsReviewing(false);
    }
  };

  // Safe markdown viewer parser
  const renderMarkdownText = (text: string) => {
    return text.split('\n').map((line, index) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={index} className="text-xs font-black text-indigo-950 uppercase mt-4 mb-2 first:mt-0 tracking-wide border-b border-indigo-200 pb-1">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <div key={index} className="text-xs text-indigo-900 font-bold flex items-start gap-2 mb-1.5">
            <span className="text-orange-500 shrink-0 text-sm leading-none">•</span>
            <span>{line.replace('- ', '')}</span>
          </div>
        );
      }
      if (line.trim().length === 0) {
        return <div key={index} className="h-2" />;
      }
      return <p key={index} className="text-xs text-indigo-900/90 font-medium leading-relaxed mb-2">{line}</p>;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Log Input Column */}
      <div className="bg-white border-2 border-slate-900 rounded-none p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-6">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 border-b-2 border-slate-900 pb-2">
            ✎ Daily Work Check-In
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wide">
            Record actual deeds, completions, and health gaps. Keep the review authentic.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-3 bg-slate-50 border-2 border-slate-900 rounded-none p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
          <Calendar className="w-5 h-5 text-slate-900 shrink-0" />
          <div className="flex-1">
            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Selected Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-transparent border-none text-sm font-black text-slate-900 focus:outline-none cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(getLocalDateString())}
            className="text-xs font-black uppercase text-slate-900 bg-white border-2 border-slate-900 px-3 py-1.5 rounded-none shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer duration-100"
          >
            Today
          </button>
        </div>

        {/* Log Textarea */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <textarea
              required
              rows={8}
              placeholder="e.g. Completed database schemas. Completed 5 major tasks. Skipped lunch to solve types. Gym active."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-900 rounded-none text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all font-sans leading-relaxed font-semibold text-slate-900"
            />
          </div>

          {feedback && (
            <div className={`p-4 rounded-none border-2 border-slate-900 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] ${
              feedback.type === 'success' 
                ? 'bg-indigo-50 text-indigo-900' 
                : 'bg-red-50 text-red-900'
            }`}>
              <div className="flex items-start gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{feedback.message}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting || isReviewing || !content.trim()}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-none border-2 border-slate-900 hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] disabled:bg-slate-100 disabled:border-slate-300 disabled:text-slate-400 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
            >
              <Send className="w-4 h-4 stroke-[3]" />
              <span>{isSubmitting ? 'Saving...' : 'Save & Get AI Review'}</span>
            </button>
            
            <button
              type="button"
              onClick={handleManualReview}
              disabled={isReviewing || isSubmitting || !content.trim()}
              className="py-3 px-4 bg-white hover:bg-slate-50 border-2 border-slate-900 text-slate-900 text-xs font-black uppercase tracking-widest rounded-none hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] disabled:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
            >
              <Sparkles className="w-4 h-4 text-slate-900 stroke-[2.5]" />
              <span>{isReviewing ? 'Analyzing...' : 'Trigger Review'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* AI Review Outcome */}
      <div className="bg-indigo-50 border-2 border-indigo-900 text-indigo-900 rounded-none p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between min-h-[450px]">
        <div>
          <div className="flex items-center justify-between gap-4 border-b-2 border-indigo-200 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-900 stroke-[2.5]" />
              <h3 className="font-black uppercase tracking-tight text-indigo-950 text-lg">AI Daily Audit</h3>
            </div>
            <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest bg-white border-2 border-indigo-900 px-2.5 py-1 rounded-none shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
              {selectedDate}
            </span>
          </div>

          {isReviewing ? (
            <div className="py-24 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-indigo-900 animate-spin mx-auto stroke-[3]" />
              <p className="text-sm font-bold uppercase tracking-widest text-indigo-900/80">Gemini is writing the audit...</p>
              <p className="text-[11px] font-semibold text-indigo-900/60 max-w-xs mx-auto">Evaluating active achievements and habits metrics against the daily criteria.</p>
            </div>
          ) : existingReview ? (
            <div className="space-y-5">
              {/* Scores Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Daily Score Badge */}
                <div className="flex items-center gap-3 bg-white rounded-none p-3 border-2 border-indigo-900 shadow-[3px_3px_0px_0px_rgba(49,46,129,1)]">
                  <div className="text-center bg-indigo-900 text-white rounded-none border-2 border-indigo-950 py-2.5 px-3 min-w-[65px]">
                    <div className="text-2xl font-black">
                      {typeof existingReview.score === 'number' ? existingReview.score.toFixed(1) : existingReview.score}
                    </div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-indigo-300">Daily / 10</div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-tight mb-0.5">
                      Daily Score
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 leading-tight">Focuses strictly on today's due Tasks and Log quality.</p>
                  </div>
                </div>

                {/* Bonus Score Badge */}
                <div className="flex items-center gap-3 bg-white rounded-none p-3 border-2 border-emerald-900 shadow-[3px_3px_0px_0px_rgba(6,78,59,1)]">
                  <div className="text-center bg-emerald-950 text-white rounded-none border-2 border-emerald-900 py-2.5 px-3 min-w-[65px]">
                    <div className="text-2xl font-black">
                      +{typeof existingReview.bonusScore === 'number' ? existingReview.bonusScore.toFixed(1) : '0.0'}
                    </div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-emerald-300">Bonus</div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-tight mb-0.5">
                      Bonus Score
                    </h4>
                    <p className="text-[10px] font-bold text-emerald-800 leading-tight">Rewards long-term & early-scheduled progress (+5.0 max).</p>
                  </div>
                </div>
              </div>

              {/* Review Markdown Content Area */}
              <div className="bg-white rounded-none p-5 border-2 border-indigo-900 shadow-[3px_3px_0px_0px_rgba(49,46,129,1)] overflow-y-auto max-h-[300px]">
                <div className="space-y-4 select-text">
                  {renderMarkdownText(existingReview.summary)}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-28 text-center space-y-4 bg-white border-2 border-indigo-200 shadow-[2px_2px_0px_0px_rgba(49,46,129,0.1)] p-8">
              <div className="w-12 h-12 rounded-none border-2 border-indigo-900 bg-indigo-100 flex items-center justify-center mx-auto text-indigo-950 text-xl font-black">
                ★
              </div>
              <div className="max-w-sm mx-auto space-y-2">
                <p className="text-sm font-black uppercase tracking-wide text-indigo-950">No review completed for today</p>
                <p className="text-xs font-semibold text-indigo-900/70">Type standard completions on writing pad and select "Save & Get AI Review" above to run diagnostic.</p>
              </div>
            </div>
          )}
        </div>

        {existingReview && !isReviewing && !isSubmitting && (
          <div className="border-t-2 border-indigo-200 pt-4 mt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="text-[9px] text-indigo-900/60 font-black uppercase tracking-widest">1 critique stored per day</span>
            <button
              onClick={handleManualReview}
              className="flex items-center gap-1.5 text-xs text-indigo-900 hover:text-indigo-950 font-black uppercase tracking-wider underline decoration-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Overwrite AI Review</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
