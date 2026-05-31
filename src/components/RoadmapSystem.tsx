import React, { useState, useEffect } from 'react';
import { RoadmapProject, RoadmapTask, RoadmapGroup } from '../types.js';
import { Plus, CheckSquare, Calendar, ChevronRight, LayoutTemplate, Briefcase, Tag, AlertCircle, Info, Sparkles, CheckCircle, RefreshCw } from 'lucide-react';

interface RichProject extends RoadmapProject {
  dateRange: string;
  progress: {
    done: number;
    total: number;
  };
  tasks: RoadmapTask[];
}

export function RoadmapSystem() {
  const [projects, setProjects] = useState<RichProject[]>([]);
  const [groups, setGroups] = useState<RoadmapGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState('ai');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Project Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGroupId, setNewGroupId] = useState('ai');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  // New Task per-project state map
  const [projectTaskInputs, setProjectTaskInputs] = useState<Record<string, string>>({});
  const [projectTaskTypes, setProjectTaskTypes] = useState<Record<string, 'learn' | 'project'>>({});

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Fetch both projects and groups
      const [projRes, groupRes] = await Promise.all([
        fetch('/api/roadmap/projects'),
        fetch('/api/roadmap/groups')
      ]);

      if (!projRes.ok || !groupRes.ok) {
        throw new Error('Failed to retrieve roadmap data from server.');
      }

      const projData = await projRes.json();
      const groupData = await groupRes.json();

      setProjects(projData);
      setGroups(groupData);

      // Default the active tab to first group if not empty
      if (groupData.length > 0 && !activeGroupId) {
        setActiveGroupId(groupData[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred while loading data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStartDate || !newEndDate) return;

    setIsSubmittingProject(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/roadmap/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          groupId: newGroupId,
          startDate: newStartDate,
          endDate: newEndDate
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to construct new project');
      }

      // Reset form
      setNewTitle('');
      setNewDesc('');
      setNewStartDate('');
      setNewEndDate('');
      
      // Select the group that was just created to view it
      setActiveGroupId(newGroupId);

      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleAddTask = async (projectId: string) => {
    const title = projectTaskInputs[projectId];
    if (!title || !title.trim()) return;
    const type = projectTaskTypes[projectId] || 'learn';

    try {
      const res = await fetch('/api/roadmap/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title: title.trim(), type })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to insert sub-task');
      }

      // Reset input
      setProjectTaskInputs(prev => ({ ...prev, [projectId]: '' }));
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    try {
      const res = await fetch(`/api/roadmap/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to toggle task completion');
      }

      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCompleteProjectManually = async (projectId: string) => {
    try {
      const res = await fetch(`/api/roadmap/projects/${projectId}/complete`, {
        method: 'PATCH'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to mark project complete');
      }

      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Helper calculation logic
  const getTimelineIndicator = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const today = new Date();

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    if (today < start) {
      const daysUntil = Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { text: `Starts in ${daysUntil} days`, percent: 0, badge: 'Scheduled' };
    }

    if (today > end) {
      const daysOver = Math.round((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
      return { text: `${daysOver} days past deadline`, percent: 100, badge: 'Overdue' };
    }

    const elapsed = Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const percent = Math.min(100, Math.round((elapsed / totalDays) * 100));
    return { text: `Day ${elapsed} of ${totalDays} (${percent}%)`, percent, badge: 'In Progress' };
  };

  const renderAsciiBar = (done: number, total: number) => {
    if (total === 0) {
      return { bar: '░░░░░░░░░0%', percentage: 0 };
    }
    const percent = Math.min(100, Math.round((done / total) * 100));
    const blockCount = Math.round(percent / 10);
    const filled = '█'.repeat(blockCount);
    const empty = '░'.repeat(10 - blockCount);
    return { bar: `${filled}${empty} ${percent}%`, percentage: percent };
  };

  // Filtered by active group tab
  const filteredProjects = projects.filter(p => p.groupId === activeGroupId);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section with summary */}
      <div className="bg-white border-2 border-slate-900 p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-slate-150 pb-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">
              Project Roadmaps
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              Context-Driven Project Containers & Flexible Sub-Tasks
            </p>
          </div>
          <button
            onClick={fetchData}
            title="Reload projects"
            className="w-full md:w-auto px-4 py-2 border-2 border-slate-900 bg-white hover:bg-slate-900 hover:text-white transition-colors duration-150 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 select-none" />
            <span>Refresh State</span>
          </button>
        </div>

        {/* Business Rules Informative Callout Card */}
        <div className="bg-indigo-50 border-2 border-indigo-900 text-indigo-900 p-4 leading-relaxed text-xs font-semibold flex items-start gap-3">
          <Info className="w-5 h-5 shrink-0 text-indigo-700 mt-0.5" />
          <div>
            <span className="font-extrabold block text-[10px] uppercase tracking-widest text-indigo-800 mb-1">
              Roadmap Structural Parameters & Rules
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-700 font-bold">
              <li><strong className="text-indigo-900">Optional Dates:</strong> Project start and end dates are display context only. Completion is independent of date.</li>
              <li><strong className="text-indigo-900">Auto-Mark:</strong> Projects automatically mark as <strong className="text-emerald-800 uppercase">Completed</strong> once all registered sub-tasks are fully checked.</li>
              <li><strong className="text-indigo-900">Manual Override:</strong> Mark a project completed anytime with the manually overrides button, regardless of sub-tasks progression.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creation panel on left */}
        <div className="bg-white border-2 border-slate-900 p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] h-fit">
          <h2 className="text-lg font-black uppercase border-b-2 border-slate-900 pb-2 mb-4 tracking-wider text-slate-900">
            + New Project Container
          </h2>

          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Project Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Mastery of LLM Embeddings"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-none text-xs font-bold placeholder-slate-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Brief Description</label>
              <textarea
                placeholder="e.g. Build vectors, cosine matching, search indexes"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-none text-xs font-bold placeholder-slate-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all resize-y"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Workspace Group Categorization</label>
              <select
                value={newGroupId}
                onChange={(e) => setNewGroupId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-none text-xs font-bold focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Start Date</label>
                <input
                  type="date"
                  required
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-2 py-2.5 bg-slate-50 border-2 border-slate-900 rounded-none text-xs font-bold focus:outline-none focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">End Date</label>
                <input
                  type="date"
                  required
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full px-2 py-2.5 bg-slate-50 border-2 border-slate-900 rounded-none text-xs font-bold focus:outline-none focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingProject || !newTitle.trim() || !newStartDate || !newEndDate}
              className="w-full py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-none border-2 border-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Initiate Project</span>
            </button>
          </form>
        </div>

        {/* Filters and Active Boards List on right */}
        <div className="lg:col-span-2 space-y-6">
          {/* 5.3 Group Categorization Filters */}
          <div className="bg-white border-2 border-slate-900 p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-2">Filter Group:</span>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroupId(g.id)}
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
                  activeGroupId === g.id
                    ? 'border-slate-900 bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'border-slate-100 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-900'
                }`}
              >
                [{g.name}]
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {isLoading ? (
              <div className="bg-white border-2 border-slate-900 p-12 text-center shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <RefreshCw className="w-8 h-8 text-slate-900 animate-spin mx-auto stroke-[3]" />
                <p className="text-xs font-black tracking-widest uppercase text-slate-400 mt-4">Gathering system state maps...</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="bg-white border-2 border-slate-900 p-12 text-center rounded-none shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <LayoutTemplate className="w-12 h-12 text-slate-300 mx-auto stroke-[1.5] mb-4" />
                <h3 className="font-extrabold uppercase text-sm tracking-widest text-slate-500 mb-1">No Active Project Registers</h3>
                <p className="text-xs text-slate-400 font-bold max-w-sm mx-auto">There are no operational roadmap containers logged inside this workspace group. Construct one using the generator utility block on the left!</p>
              </div>
            ) : (
              filteredProjects.map((project) => {
                const asciiProgress = renderAsciiBar(project.progress.done, project.progress.total);
                const timeline = getTimelineIndicator(project.startDate, project.endDate);

                return (
                  <div
                    key={project.id}
                    className={`bg-white border-2 border-slate-900 p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] transition-all ${
                      project.status === 'completed' ? 'bg-slate-50/70 opacity-90' : ''
                    }`}
                  >
                    {/* Project Title Block Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b-2 border-slate-900 pb-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black uppercase text-slate-900 tracking-tight leading-tight">
                            {project.title}
                          </h3>
                        </div>
                        {project.description && (
                          <p className="text-xs font-semibold text-slate-500 mt-1 whitespace-pre-line">
                            {project.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5">
                            <Calendar className="w-3 h-3" />
                            [{project.dateRange}]
                          </span>
                          <span className={`${
                            timeline.badge === 'Overdue' ? 'text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5' :
                            timeline.badge === 'In Progress' ? 'text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5' :
                            'text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5'
                          }`}>
                            Timeline: {timeline.text}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {project.status === 'completed' ? (
                          <span className="border-2 border-emerald-950 bg-emerald-100 text-emerald-950 rounded px-2.5 py-1 text-xs font-black tracking-widest uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(6,78,59,1)]">
                            <CheckCircle className="w-4 h-4 fill-emerald-100" />
                            Completed
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="border-2 border-indigo-950 bg-indigo-100 text-indigo-950 rounded px-2.5 py-1 text-xs font-black tracking-widest uppercase">
                              Active
                            </span>
                            <button
                              onClick={() => handleCompleteProjectManually(project.id)}
                              className="px-3 py-1 bg-white hover:bg-slate-900 hover:text-white text-[10px] font-black uppercase tracking-wider border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all cursor-pointer"
                            >
                              Complete Manual
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress visual indicators */}
                    <div className="mb-5 space-y-2.5 bg-slate-50 border border-slate-300 p-3 font-mono text-xs font-black text-slate-800">
                      <div className="flex justify-between items-center text-[10px] uppercase">
                        <span>Progress Metrics</span>
                        <span className="bg-slate-900 text-white px-1">{project.progress.done} of {project.progress.total} Tasks</span>
                      </div>
                      <div className="text-sm select-all tracking-wide bg-white border border-slate-400 p-2 text-slate-900 leading-none">
                        {asciiProgress.bar}
                      </div>
                    </div>

                    {/* Sub-tasks lists (5.2 Task List inside Project) */}
                    <div className="mb-4">
                      {project.tasks.length === 0 ? (
                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 text-center py-4 bg-slate-50 border border-dashed border-slate-300">
                          Empty backlog. Register a Learn or Project task below!
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* 📚 Learn Category */}
                          <div className="bg-amber-50/20 border border-amber-900/15 p-2.5">
                            <div className="flex items-center justify-between border-b border-amber-900/10 pb-1 mb-2">
                              <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider flex items-center gap-1">
                                📚 Learn
                              </span>
                              <span className="bg-amber-100 text-amber-900 text-[9px] font-black px-1.5 py-0.2">
                                {project.tasks.filter(t => t.type === 'learn' && t.completed).length}/{project.tasks.filter(t => t.type === 'learn').length}
                              </span>
                            </div>
                            
                            {project.tasks.filter(t => t.type === 'learn').length === 0 ? (
                              <p className="text-[9px] font-bold text-slate-400 py-3 text-center border border-dashed border-slate-200">
                                No learning items yet
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {project.tasks.filter(t => t.type === 'learn').map((task) => (
                                  <button
                                    key={task.id}
                                    onClick={() => handleToggleTask(task.id, task.completed)}
                                    className={`w-full text-left p-2 border border-slate-950 rounded-none transition-all cursor-pointer select-none text-[11px] font-bold flex items-center justify-between hover:bg-slate-50 ${
                                      task.completed
                                        ? 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                        : 'bg-white text-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-3.5 h-3.5 shrink-0 border-2 border-slate-900 flex items-center justify-center font-mono text-[9px] ${
                                        task.completed ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
                                      }`}>
                                        {task.completed ? '✓' : ''}
                                      </span>
                                      <span className={`truncate ${task.completed ? 'line-through decoration-slate-400 decoration-1' : ''}`}>
                                        {task.title}
                                      </span>
                                    </div>
                                    {task.completed && task.completedAt && (
                                      <span className="text-[8px] font-mono text-slate-400 shrink-0 ml-1">
                                        {new Date(task.completedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 🛠️ Project Category */}
                          <div className="bg-blue-50/20 border border-blue-900/15 p-2.5">
                            <div className="flex items-center justify-between border-b border-blue-900/10 pb-1 mb-2">
                              <span className="text-[10px] font-black uppercase text-blue-900 tracking-wider flex items-center gap-1">
                                🛠️ Project
                              </span>
                              <span className="bg-blue-100 text-blue-900 text-[9px] font-black px-1.5 py-0.2">
                                {project.tasks.filter(t => t.type === 'project' && t.completed).length}/{project.tasks.filter(t => t.type === 'project').length}
                              </span>
                            </div>

                            {project.tasks.filter(t => t.type === 'project').length === 0 ? (
                              <p className="text-[9px] font-bold text-slate-400 py-3 text-center border border-dashed border-slate-200">
                                No project tasks yet
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {project.tasks.filter(t => t.type === 'project').map((task) => (
                                  <button
                                    key={task.id}
                                    onClick={() => handleToggleTask(task.id, task.completed)}
                                    className={`w-full text-left p-2 border border-slate-950 rounded-none transition-all cursor-pointer select-none text-[11px] font-bold flex items-center justify-between hover:bg-slate-50 ${
                                      task.completed
                                        ? 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                        : 'bg-white text-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-3.5 h-3.5 shrink-0 border-2 border-slate-900 flex items-center justify-center font-mono text-[9px] ${
                                        task.completed ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
                                      }`}>
                                        {task.completed ? '✓' : ''}
                                      </span>
                                      <span className={`truncate ${task.completed ? 'line-through decoration-slate-400 decoration-1' : ''}`}>
                                        {task.title}
                                      </span>
                                    </div>
                                    {task.completed && task.completedAt && (
                                      <span className="text-[8px] font-mono text-slate-400 shrink-0 ml-1">
                                        {new Date(task.completedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4.2 Add Task to Project control with Type Selector */}
                    <div className="border-t-2 border-slate-100 pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-y-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <span>Select Subtask Category:</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setProjectTaskTypes(prev => ({ ...prev, [project.id]: 'learn' }))}
                            className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
                              (projectTaskTypes[project.id] || 'learn') === 'learn'
                                ? 'border-amber-900 bg-amber-50/70 text-amber-900 shadow-[1px_1px_0px_0px_rgba(120,53,4,1)]'
                                : 'border-slate-100 text-slate-400 bg-slate-50/50 hover:text-slate-950'
                            }`}
                          >
                            📚 Learn
                          </button>
                          <button
                            type="button"
                            onClick={() => setProjectTaskTypes(prev => ({ ...prev, [project.id]: 'project' }))}
                            className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
                              projectTaskTypes[project.id] === 'project'
                                ? 'border-indigo-900 bg-indigo-50/70 text-indigo-900 shadow-[1px_1px_0px_0px_rgba(49,46,129,1)] font-black'
                                : 'border-slate-100 text-slate-400 bg-slate-50/50 hover:text-slate-950'
                            }`}
                          >
                            🛠️ Build Task
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={`Register new ${(projectTaskTypes[project.id] || 'learn') === 'learn' ? 'learning item' : 'build step'}...`}
                          value={projectTaskInputs[project.id] || ''}
                          onChange={(e) => setProjectTaskInputs(prev => ({ ...prev, [project.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTask(project.id);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 bg-slate-50 border-2 border-slate-900 rounded-none text-xs font-bold focus:outline-none placeholder-slate-400 focus:bg-white"
                        />
                        <button
                          onClick={() => handleAddTask(project.id)}
                          disabled={!projectTaskInputs[project.id]?.trim()}
                          className="px-4 py-1.5 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-none border-2 border-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
                        >
                          Add Task
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
