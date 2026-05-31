export interface Task {
  id: number;
  title: string;
  category: string;
  completed: boolean;
  createdAt: string;
}

export interface DailyLog {
  id: number;
  date: string; // YYYY-MM-DD
  content: string;
}

export interface AIReview {
  id: number;
  date: string; // YYYY-MM-DD
  summary: string;
  score: number; // 1-10
}

export interface Achievement {
  id: number;
  text: string;
  createdAt: string; // ISO string or format
}

export interface HistoryItem {
  date: string;
  tasksCompleted: { title: string; category: string }[];
  log?: string;
  aiReview?: {
    summary: string;
    score: number;
  };
  achievements: string[];
}

export interface DashboardStats {
  today: string;
  activeTasks: number;
  completedTasks: number;
  progressPercentage: number;
  streak: number;
}

export interface RoadmapGroup {
  id: string;
  name: string;
}

export interface RoadmapProject {
  id: string;
  title: string;
  description?: string;
  groupId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  status: 'active' | 'completed';
  createdAt: string;
}

export interface RoadmapTask {
  id: string;
  projectId: string;
  title: string;
  type: 'learn' | 'project';
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

