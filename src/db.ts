import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { Task, DailyLog, AIReview, Achievement, RoadmapGroup, RoadmapProject, RoadmapTask, Activity } from './types';

const requireHelper = createRequire(path.join(process.cwd(), 'dummy.js'));

const DB_FILE_PATH = path.join(process.cwd(), 'productivity.db');
const JSON_BACKUP_PATH = path.join(process.cwd(), 'productivity.db.json');

// Interface for db methods so we have a unified client
interface DatabaseClient {
  init(): Promise<void>;
  getTasks(): Promise<Task[]>;
  createTask(title: string, category: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'scheduled', scheduleDate: string | null): Promise<Task>;
  toggleTask(id: number): Promise<Task | null>;
  deleteTask(id: number): Promise<boolean>;
  getLogs(): Promise<DailyLog[]>;
  saveLog(date: string, content: string): Promise<DailyLog>;
  getReviews(): Promise<AIReview[]>;
  saveReview(date: string, summary: string, score: number): Promise<AIReview>;
  getAchievements(): Promise<Achievement[]>;
  createAchievement(text: string): Promise<Achievement>;
  deleteAchievementByText(text: string): Promise<void>;
  getActivities(): Promise<Activity[]>;
  createActivity(type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed', sourceId: string, title: string): Promise<Activity>;
  deleteActivityBySourceId(sourceId: string, type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed'): Promise<void>;

  // Roadmap methods
  getRoadmapGroups(): Promise<RoadmapGroup[]>;
  getRoadmapProjects(): Promise<RoadmapProject[]>;
  getRoadmapTasks(): Promise<RoadmapTask[]>;
  createRoadmapProject(title: string, description: string, groupId: string, startDate: string, endDate: string): Promise<RoadmapProject>;
  createRoadmapTask(projectId: string, title: string, type: 'learn' | 'project'): Promise<RoadmapTask>;
  toggleRoadmapTask(id: string, completed?: boolean): Promise<RoadmapTask | null>;
  completeRoadmapProject(id: string): Promise<RoadmapProject | null>;
}

// ----------------------------------------------------
// IMPLEMENTATION A: JSON Local Storage Client (Resilient Fallback)
// ----------------------------------------------------
class JsonDBClient implements DatabaseClient {
  private data: {
    tasks: Task[];
    daily_logs: DailyLog[];
    ai_reviews: AIReview[];
    achievements: Achievement[];
    activities: Activity[];
    roadmap_projects: RoadmapProject[];
    roadmap_tasks: RoadmapTask[];
    roadmap_groups: RoadmapGroup[];
  } = {
    tasks: [],
    daily_logs: [],
    ai_reviews: [],
    achievements: [],
    activities: [],
    roadmap_projects: [],
    roadmap_tasks: [],
    roadmap_groups: [
      { id: 'ai', name: 'AI' },
      { id: 'fitness', name: 'Fitness' },
      { id: 'drawing', name: 'Drawing' }
    ],
  };

  async init() {
    if (fs.existsSync(JSON_BACKUP_PATH)) {
      try {
        const fileContent = fs.readFileSync(JSON_BACKUP_PATH, 'utf-8');
        this.data = JSON.parse(fileContent);
        // Ensure all arrays exist
        this.data.tasks = this.data.tasks || [];
        this.data.daily_logs = this.data.daily_logs || [];
        this.data.ai_reviews = this.data.ai_reviews || [];
        this.data.achievements = this.data.achievements || [];
        this.data.activities = this.data.activities || [];
        this.data.roadmap_projects = this.data.roadmap_projects || [];
        this.data.roadmap_tasks = this.data.roadmap_tasks || [];
        this.data.roadmap_groups = this.data.roadmap_groups || [];

        // Check if groups are empty or need default seed
        if (this.data.roadmap_groups.length === 0) {
          this.data.roadmap_groups = [
            { id: 'ai', name: 'AI' },
            { id: 'fitness', name: 'Fitness' },
            { id: 'drawing', name: 'Drawing' }
          ];
        }
      } catch (err) {
        console.error('Error parsing backup JSON, using blank template', err);
      }
    } else {
      this.save();
    }
  }

  private save() {
    try {
      fs.writeFileSync(JSON_BACKUP_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save JSON database', err);
    }
  }

  async getTasks(): Promise<Task[]> {
    return (this.data.tasks || []).map(t => ({
      ...t,
      type: t.type || 'daily',
      completedAt: t.completedAt || null,
      scheduleDate: t.scheduleDate || null
    }));
  }

  async createTask(title: string, category: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'scheduled' = 'daily', scheduleDate: string | null = null): Promise<Task> {
    const newTask: Task = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title,
      category,
      type,
      completed: false,
      completedAt: null,
      scheduleDate,
      createdAt: new Date().toISOString(),
    };
    this.data.tasks.push(newTask);
    this.save();
    return newTask;
  }

  async toggleTask(id: number): Promise<Task | null> {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) return null;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    this.save();
    return task;
  }

  async deleteTask(id: number): Promise<boolean> {
    const initialLen = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    const deleted = this.data.tasks.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  async getLogs(): Promise<DailyLog[]> {
    return this.data.daily_logs;
  }

  async saveLog(date: string, content: string): Promise<DailyLog> {
    const existingIndex = this.data.daily_logs.findIndex((l) => l.date === date);
    const newLog: DailyLog = {
      id: existingIndex >= 0 ? this.data.daily_logs[existingIndex].id : Date.now(),
      date,
      content,
    };

    if (existingIndex >= 0) {
      this.data.daily_logs[existingIndex] = newLog;
    } else {
      this.data.daily_logs.push(newLog);
    }
    this.save();
    return newLog;
  }

  async getReviews(): Promise<AIReview[]> {
    return this.data.ai_reviews;
  }

  async saveReview(date: string, summary: string, score: number): Promise<AIReview> {
    const existingIndex = this.data.ai_reviews.findIndex((r) => r.date === date);
    const newReview: AIReview = {
      id: existingIndex >= 0 ? this.data.ai_reviews[existingIndex].id : Date.now(),
      date,
      summary,
      score,
    };

    if (existingIndex >= 0) {
      this.data.ai_reviews[existingIndex] = newReview;
    } else {
      this.data.ai_reviews.push(newReview);
    }
    this.save();
    return newReview;
  }

  async getAchievements(): Promise<Achievement[]> {
    return this.data.achievements;
  }

  async createAchievement(text: string): Promise<Achievement> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const existing = (this.data.achievements || []).find(ach => ach.text === text && ach.createdAt.startsWith(todayStr));
    if (existing) {
      return existing;
    }
    const newAchievement: Achievement = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      text,
      createdAt: new Date().toISOString(),
    };
    this.data.achievements.push(newAchievement);
    this.save();
    return newAchievement;
  }

  async deleteAchievementByText(text: string): Promise<void> {
    this.data.achievements = (this.data.achievements || []).filter(ach => ach.text !== text);
    this.save();
  }

  async getActivities(): Promise<Activity[]> {
    return this.data.activities || [];
  }

  async createActivity(type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed', sourceId: string, title: string): Promise<Activity> {
    const existing = (this.data.activities || []).find(act => act.type === type && act.sourceId === sourceId);
    if (existing) {
      return existing;
    }
    const newActivity: Activity = {
      id: 'act_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type,
      sourceId,
      title,
      createdAt: new Date().toISOString()
    };
    this.data.activities.push(newActivity);
    this.save();
    return newActivity;
  }

  async deleteActivityBySourceId(sourceId: string, type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed'): Promise<void> {
    this.data.activities = (this.data.activities || []).filter(act => !(act.sourceId === sourceId && act.type === type));
    this.save();
  }

  async getRoadmapGroups(): Promise<RoadmapGroup[]> {
    return this.data.roadmap_groups;
  }

  async getRoadmapProjects(): Promise<RoadmapProject[]> {
    return this.data.roadmap_projects;
  }

  async getRoadmapTasks(): Promise<RoadmapTask[]> {
    return this.data.roadmap_tasks.map(t => ({
      ...t,
      type: t.type || 'learn'
    }));
  }

  async createRoadmapProject(title: string, description: string, groupId: string, startDate: string, endDate: string): Promise<RoadmapProject> {
    const newProject: RoadmapProject = {
      id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      title,
      description,
      groupId,
      startDate,
      endDate,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    this.data.roadmap_projects.push(newProject);
    this.save();
    return newProject;
  }

  async createRoadmapTask(projectId: string, title: string, type: 'learn' | 'project'): Promise<RoadmapTask> {
    const newTask: RoadmapTask = {
      id: 't_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      projectId,
      title,
      type,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    };
    this.data.roadmap_tasks.push(newTask);
    this.save();
    return newTask;
  }

  async toggleRoadmapTask(id: string, completed?: boolean): Promise<RoadmapTask | null> {
    const task = this.data.roadmap_tasks.find(t => t.id === id);
    if (!task) return null;

    const nextCompleted = completed !== undefined ? completed : !task.completed;
    const oldCompleted = task.completed;
    task.completed = nextCompleted;
    task.completedAt = nextCompleted ? new Date().toISOString() : null;

    if (nextCompleted && !oldCompleted) {
      // 1. Create activity record
      await this.createActivity('roadmap_step_completed', task.id, task.title);
      // 2. Create achievement record
      await this.createAchievement(`Completed roadmap step: ${task.title}`);
    } else if (!nextCompleted && oldCompleted) {
      // 1. Delete activity record
      await this.deleteActivityBySourceId(task.id, 'roadmap_step_completed');
      // 2. Delete achievement record
      await this.deleteAchievementByText(`Completed roadmap step: ${task.title}`);
    }

    // Check Auto-completion Rules (3.2 Completion Rule)
    const projectTasks = this.data.roadmap_tasks.filter(t => t.projectId === task.projectId);
    if (projectTasks.length > 0 && projectTasks.every(t => t.completed)) {
      const project = this.data.roadmap_projects.find(p => p.id === task.projectId);
      if (project && project.status !== 'completed') {
        project.status = 'completed';
        // Create activity record
        await this.createActivity('roadmap_project_completed', project.id, project.title);
        // Create achievement record
        await this.createAchievement(`Completed roadmap: ${project.title}`);
      }
    }

    this.save();
    return task;
  }

  async completeRoadmapProject(id: string): Promise<RoadmapProject | null> {
    const project = this.data.roadmap_projects.find(p => p.id === id);
    if (!project) return null;
    const oldStatus = project.status;
    project.status = 'completed';
    if (oldStatus !== 'completed') {
      await this.createActivity('roadmap_project_completed', project.id, project.title);
      await this.createAchievement(`Completed roadmap: ${project.title}`);
    }
    this.save();
    return project;
  }
}

// ----------------------------------------------------
// IMPLEMENTATION B: Node Native SQLite Client
// ----------------------------------------------------
class SQLiteDBClient implements DatabaseClient {
  private db: any = null;

  constructor(private DatabaseSyncClass: any) {}

  async init() {
    this.db = new this.DatabaseSyncClass(DB_FILE_PATH);

    // Create necessary tables if not exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'daily',
        completed INTEGER NOT NULL DEFAULT 0,
        completedAt TEXT,
        scheduleDate TEXT,
        createdAt TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,
        summary TEXT NOT NULL,
        score INTEGER NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        sourceId TEXT NOT NULL,
        title TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);

    // Roadmap schemas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roadmap_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roadmap_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        groupId TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active', 'completed')),
        createdAt TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roadmap_tasks (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'learn',
        completed INTEGER NOT NULL DEFAULT 0,
        completedAt TEXT,
        createdAt TEXT NOT NULL
      );
    `);

    // Seed default roadmap groups
    const countQuery = this.db.prepare('SELECT count(*) as count FROM roadmap_groups').get();
    if (countQuery && countQuery.count === 0) {
      const insertGroup = this.db.prepare('INSERT INTO roadmap_groups (id, name) VALUES (?, ?)');
      insertGroup.run('ai', 'AI');
      insertGroup.run('fitness', 'Fitness');
      insertGroup.run('drawing', 'Drawing');
    }

    // Ensure type column exists on older DBs
    try {
      this.db.exec('ALTER TABLE roadmap_tasks ADD COLUMN type TEXT NOT NULL DEFAULT "learn"');
    } catch (e) {
      // Column may already exist, ignore error safely
    }

    // Ensure task type, completedAt, and scheduleDate columns exist on older DBs
    try {
      this.db.exec("ALTER TABLE tasks ADD COLUMN type TEXT NOT NULL DEFAULT 'daily'");
    } catch (e) {}
    try {
      this.db.exec("ALTER TABLE tasks ADD COLUMN completedAt TEXT");
    } catch (e) {}
    try {
      this.db.exec("ALTER TABLE tasks ADD COLUMN scheduleDate TEXT");
    } catch (e) {}

    console.log('node:sqlite tables verified/created successfully.');
  }

  async getTasks(): Promise<Task[]> {
    const query = this.db.prepare('SELECT id, title, category, type, completed, completedAt, scheduleDate, createdAt FROM tasks ORDER BY id DESC');
    const rows = query.all();
    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      type: (row.type || 'daily') as any,
      completed: Boolean(row.completed),
      completedAt: row.completedAt || null,
      scheduleDate: row.scheduleDate || null,
      createdAt: row.createdAt,
    }));
  }

  async createTask(title: string, category: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'scheduled' = 'daily', scheduleDate: string | null = null): Promise<Task> {
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare('INSERT INTO tasks (title, category, type, completed, completedAt, scheduleDate, createdAt) VALUES (?, ?, ?, 0, NULL, ?, ?)');
    const result = stmt.run(title, category, type, scheduleDate, createdAt);
    return {
      id: Number(result.lastInsertRowid),
      title,
      category,
      type,
      completed: false,
      completedAt: null,
      scheduleDate,
      createdAt,
    };
  }

  async toggleTask(id: number): Promise<Task | null> {
    // Get current state
    const selectStmt = this.db.prepare('SELECT id, title, category, type, completed, completedAt, scheduleDate, createdAt FROM tasks WHERE id = ?');
    const task = selectStmt.get(id);
    if (!task) return null;

    const nextCompleted = task.completed === 1 ? 0 : 1;
    const nextCompletedAt = nextCompleted === 1 ? new Date().toISOString() : null;
    const updateStmt = this.db.prepare('UPDATE tasks SET completed = ?, completedAt = ? WHERE id = ?');
    updateStmt.run(nextCompleted, nextCompletedAt, id);

    return {
      id: task.id,
      title: task.title,
      category: task.category,
      type: (task.type || 'daily') as any,
      completed: Boolean(nextCompleted),
      completedAt: nextCompletedAt,
      scheduleDate: task.scheduleDate || null,
      createdAt: task.createdAt,
    };
  }

  async deleteTask(id: number): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async getLogs(): Promise<DailyLog[]> {
    const query = this.db.prepare('SELECT id, date, content FROM daily_logs');
    return query.all().map((row: any) => ({
      id: row.id,
      date: row.date,
      content: row.content,
    }));
  }

  async saveLog(date: string, content: string): Promise<DailyLog> {
    // UPSERT or Insert-or-replace
    const stmt = this.db.prepare(`
      INSERT INTO daily_logs (date, content)
      VALUES (?, ?)
      ON CONFLICT(date) DO UPDATE SET content = excluded.content
    `);
    stmt.run(date, content);

    // Get the log to return
    const getStmt = this.db.prepare('SELECT id, date, content FROM daily_logs WHERE date = ?');
    const row = getStmt.get(date);
    return {
      id: row.id,
      date: row.date,
      content: row.content,
    };
  }

  async getReviews(): Promise<AIReview[]> {
    const query = this.db.prepare('SELECT id, date, summary, score FROM ai_reviews');
    return query.all().map((row: any) => ({
      id: row.id,
      date: row.date,
      summary: row.summary,
      score: row.score,
    }));
  }

  async saveReview(date: string, summary: string, score: number): Promise<AIReview> {
    const stmt = this.db.prepare(`
      INSERT INTO ai_reviews (date, summary, score)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET summary = excluded.summary, score = excluded.score
    `);
    stmt.run(date, summary, score);

    const getStmt = this.db.prepare('SELECT id, date, summary, score FROM ai_reviews WHERE date = ?');
    const row = getStmt.get(date);
    return {
      id: row.id,
      date: row.date,
      summary: row.summary,
      score: row.score,
    };
  }

  async getAchievements(): Promise<Achievement[]> {
    const query = this.db.prepare('SELECT id, text, createdAt FROM achievements ORDER BY id DESC');
    return query.all().map((row: any) => ({
      id: row.id,
      text: row.text,
      createdAt: row.createdAt,
    }));
  }

  async createAchievement(text: string): Promise<Achievement> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const checkStmt = this.db.prepare('SELECT id, text, createdAt FROM achievements WHERE text = ? AND createdAt LIKE ? LIMIT 1');
    const existing = checkStmt.get(text, `${todayStr}%`);
    if (existing) {
      return {
        id: existing.id,
        text: existing.text,
        createdAt: existing.createdAt
      };
    }
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare('INSERT INTO achievements (text, createdAt) VALUES (?, ?)');
    const result = stmt.run(text, createdAt);
    return {
      id: Number(result.lastInsertRowid),
      text,
      createdAt,
    };
  }

  async deleteAchievementByText(text: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM achievements WHERE text = ?');
    stmt.run(text);
  }

  async getActivities(): Promise<Activity[]> {
    const query = this.db.prepare('SELECT id, type, sourceId, title, createdAt FROM activities ORDER BY id DESC');
    return query.all().map((row: any) => ({
      id: row.id,
      type: row.type as any,
      sourceId: row.sourceId,
      title: row.title,
      createdAt: row.createdAt,
    }));
  }

  async createActivity(type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed', sourceId: string, title: string): Promise<Activity> {
    const checkStmt = this.db.prepare('SELECT id, type, sourceId, title, createdAt FROM activities WHERE type = ? AND sourceId = ? LIMIT 1');
    const existing = checkStmt.get(type, sourceId);
    if (existing) {
      return {
        id: existing.id,
        type: existing.type as any,
        sourceId: existing.sourceId,
        title: existing.title,
        createdAt: existing.createdAt
      };
    }
    const id = 'act_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare('INSERT INTO activities (id, type, sourceId, title, createdAt) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, type, sourceId, title, createdAt);
    return {
      id,
      type,
      sourceId,
      title,
      createdAt,
    };
  }

  async deleteActivityBySourceId(sourceId: string, type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed'): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM activities WHERE sourceId = ? AND type = ?');
    stmt.run(sourceId, type);
  }

  async getRoadmapGroups(): Promise<RoadmapGroup[]> {
    const rows = this.db.prepare('SELECT id, name FROM roadmap_groups').all();
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
    }));
  }

  async getRoadmapProjects(): Promise<RoadmapProject[]> {
    const rows = this.db.prepare('SELECT id, title, description, groupId, startDate, endDate, status, createdAt FROM roadmap_projects ORDER BY createdAt DESC').all();
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description || undefined,
      groupId: r.groupId,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status as 'active' | 'completed',
      createdAt: r.createdAt,
    }));
  }

  async getRoadmapTasks(): Promise<RoadmapTask[]> {
    const rows = this.db.prepare('SELECT id, projectId, title, type, completed, completedAt, createdAt FROM roadmap_tasks').all();
    return rows.map((r: any) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      type: (r.type || 'learn') as 'learn' | 'project',
      completed: Boolean(r.completed),
      completedAt: r.completedAt || null,
      createdAt: r.createdAt,
    }));
  }

  async createRoadmapProject(title: string, description: string, groupId: string, startDate: string, endDate: string): Promise<RoadmapProject> {
    const id = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const createdAt = new Date().toISOString();
    const status = 'active';
    const stmt = this.db.prepare('INSERT INTO roadmap_projects (id, title, description, groupId, startDate, endDate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, title, description, groupId, startDate, endDate, status, createdAt);
    return {
      id,
      title,
      description: description || undefined,
      groupId,
      startDate,
      endDate,
      status,
      createdAt,
    };
  }

  async createRoadmapTask(projectId: string, title: string, type: 'learn' | 'project'): Promise<RoadmapTask> {
    const id = 't_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const createdAt = new Date().toISOString();
    const completed = 0;
    const stmt = this.db.prepare('INSERT INTO roadmap_tasks (id, projectId, title, type, completed, completedAt, createdAt) VALUES (?, ?, ?, ?, ?, NULL, ?)');
    stmt.run(id, projectId, title, type, completed, createdAt);
    return {
      id,
      projectId,
      title,
      type,
      completed: false,
      completedAt: null,
      createdAt,
    };
  }

  async toggleRoadmapTask(id: string, completed?: boolean): Promise<RoadmapTask | null> {
    // Get current task state
    const task = this.db.prepare('SELECT id, projectId, title, type, completed, completedAt, createdAt FROM roadmap_tasks WHERE id = ?').get(id);
    if (!task) return null;

    const nextCompleted = completed !== undefined ? (completed ? 1 : 0) : (task.completed === 1 ? 0 : 1);
    const nextCompletedAt = nextCompleted === 1 ? new Date().toISOString() : null;

    const updateStmt = this.db.prepare('UPDATE roadmap_tasks SET completed = ?, completedAt = ? WHERE id = ?');
    updateStmt.run(nextCompleted, nextCompletedAt, id);

    if (nextCompleted === 1 && task.completed === 0) {
      // 1. Create activity record
      await this.createActivity('roadmap_step_completed', task.id, task.title);
      // 2. Create achievement record
      await this.createAchievement(`Completed roadmap step: ${task.title}`);
    } else if (nextCompleted === 0 && task.completed === 1) {
      // 1. Delete activity record
      await this.deleteActivityBySourceId(task.id, 'roadmap_step_completed');
      // 2. Delete achievement record
      await this.deleteAchievementByText(`Completed roadmap step: ${task.title}`);
    }

    // Business check Rule: "3.2 Completion Rule: A RoadmapProject is completed when: ALL RoadmapTask.completed == true"
    // Fetch all siblings of this task
    const siblingTasks = this.db.prepare('SELECT completed FROM roadmap_tasks WHERE projectId = ?').all(task.projectId);
    if (siblingTasks.length > 0 && siblingTasks.every((t: any) => t.completed === 1)) {
      // Check if project was not already completed
      const project = this.db.prepare('SELECT id, title, status FROM roadmap_projects WHERE id = ?').get(task.projectId);
      if (project && project.status !== 'completed') {
        const updateProject = this.db.prepare("UPDATE roadmap_projects SET status = 'completed' WHERE id = ?");
        updateProject.run(task.projectId);

        await this.createActivity('roadmap_project_completed', project.id, project.title);
        await this.createAchievement(`Completed roadmap: ${project.title}`);
      }
    }

    return {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      type: (task.type || 'learn') as 'learn' | 'project',
      completed: Boolean(nextCompleted),
      completedAt: nextCompletedAt,
      createdAt: task.createdAt,
    };
  }

  async completeRoadmapProject(id: string): Promise<RoadmapProject | null> {
    const project = this.db.prepare('SELECT id, title, description, groupId, startDate, endDate, status, createdAt FROM roadmap_projects WHERE id = ?').get(id);
    if (!project) return null;

    if (project.status !== 'completed') {
      const updateStmt = this.db.prepare("UPDATE roadmap_projects SET status = 'completed' WHERE id = ?");
      updateStmt.run(id);

      await this.createActivity('roadmap_project_completed', project.id, project.title);
      await this.createAchievement(`Completed roadmap: ${project.title}`);
    }

    return {
      id: project.id,
      title: project.title,
      description: project.description || undefined,
      groupId: project.groupId,
      startDate: project.startDate,
      endDate: project.endDate,
      status: 'completed',
      createdAt: project.createdAt,
    };
  }
}

// ----------------------------------------------------
// IMPLEMENTATION C: Real MySQL Connection Pool Client
// ----------------------------------------------------
class MySQLDBClient implements DatabaseClient {
  private pool: any = null;

  constructor(private customConfig?: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    uri?: string;
  }) {}

  async init() {
    const mysql = requireHelper('mysql2/promise');
    
    const host = this.customConfig?.host || process.env.MYSQL_HOST || '127.0.0.1';
    const port = Number(this.customConfig?.port || process.env.MYSQL_PORT) || 3306;
    const user = this.customConfig?.user || process.env.MYSQL_USER || 'root';
    const password = this.customConfig?.password !== undefined ? this.customConfig.password : (process.env.MYSQL_PASSWORD || '');
    const database = this.customConfig?.database || process.env.MYSQL_DATABASE || 'productivity';
    const uri = this.customConfig?.uri !== undefined ? this.customConfig.uri : (process.env.MYSQL_URL || process.env.DATABASE_URL || '');

    console.log('Establishing MySQL Connection Pool...');
    if (uri && uri.trim()) {
      this.pool = mysql.createPool(uri);
    } else {
      this.pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
    }

    // Run custom migrations to establish schema logic tables
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        type VARCHAR(255) NOT NULL DEFAULT 'daily',
        completed TINYINT(1) NOT NULL DEFAULT 0,
        completedAt VARCHAR(255),
        scheduleDate VARCHAR(255),
        createdAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date VARCHAR(255) UNIQUE NOT NULL,
        content TEXT NOT NULL
      ) ENGINE=InnoDB;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS ai_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date VARCHAR(255) UNIQUE NOT NULL,
        summary TEXT NOT NULL,
        score INT NOT NULL
      ) ENGINE=InnoDB;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS achievements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        text VARCHAR(255) NOT NULL,
        createdAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS activities (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(255) NOT NULL,
        sourceId VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        createdAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS roadmap_groups (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS roadmap_projects (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        groupId VARCHAR(255) NOT NULL,
        startDate VARCHAR(255) NOT NULL,
        endDate VARCHAR(255) NOT NULL,
        status VARCHAR(255) NOT NULL,
        createdAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS roadmap_tasks (
        id VARCHAR(255) PRIMARY KEY,
        projectId VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(255) NOT NULL DEFAULT 'learn',
        completed TINYINT(1) NOT NULL DEFAULT 0,
        completedAt VARCHAR(255),
        createdAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB;
    `);

    // Seed roadmap default groups
    const [rows]: any = await this.pool.execute('SELECT COUNT(*) as count FROM roadmap_groups');
    if (rows && rows[0] && rows[0].count === 0) {
      await this.pool.execute(`
        INSERT INTO roadmap_groups (id, name) VALUES 
        ('ai', 'AI'), 
        ('fitness', 'Fitness'), 
        ('drawing', 'Drawing')
      `);
    }

    // Ensure type column exists on older DBs
    try {
      await this.pool.execute('ALTER TABLE roadmap_tasks ADD COLUMN type VARCHAR(255) NOT NULL DEFAULT "learn"');
    } catch (e) {
      // Column may already exist, ignore error safely
    }

    // Ensure tasks new columns exist on older DBs
    try {
      await this.pool.execute("ALTER TABLE tasks ADD COLUMN type VARCHAR(255) NOT NULL DEFAULT 'daily'");
    } catch (e) {}
    try {
      await this.pool.execute("ALTER TABLE tasks ADD COLUMN completedAt VARCHAR(255)");
    } catch (e) {}
    try {
      await this.pool.execute("ALTER TABLE tasks ADD COLUMN scheduleDate VARCHAR(255)");
    } catch (e) {}

    console.log('MySQL schemas initialized and connected successfully.');
  }

  async getTasks(): Promise<Task[]> {
    const [rows]: any = await this.pool.execute('SELECT id, title, category, type, completed, completedAt, scheduleDate, createdAt FROM tasks ORDER BY id DESC');
    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      type: (row.type || 'daily') as any,
      completed: Boolean(row.completed),
      completedAt: row.completedAt || null,
      scheduleDate: row.scheduleDate || null,
      createdAt: row.createdAt,
    }));
  }

  async createTask(title: string, category: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'scheduled' = 'daily', scheduleDate: string | null = null): Promise<Task> {
    const createdAt = new Date().toISOString();
    const [result]: any = await this.pool.execute('INSERT INTO tasks (title, category, type, completed, completedAt, scheduleDate, createdAt) VALUES (?, ?, ?, 0, NULL, ?, ?)', [title, category, type, scheduleDate, createdAt]);
    return {
      id: Number(result.insertId),
      title,
      category,
      type,
      completed: false,
      completedAt: null,
      scheduleDate,
      createdAt,
    };
  }

  async toggleTask(id: number): Promise<Task | null> {
    const [rows]: any = await this.pool.execute('SELECT id, title, category, type, completed, completedAt, scheduleDate, createdAt FROM tasks WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return null;
    const task = rows[0];

    const nextCompleted = task.completed === 1 ? 0 : 1;
    const nextCompletedAt = nextCompleted === 1 ? new Date().toISOString() : null;
    await this.pool.execute('UPDATE tasks SET completed = ?, completedAt = ? WHERE id = ?', [nextCompleted, nextCompletedAt, id]);

    return {
      id: task.id,
      title: task.title,
      category: task.category,
      type: (task.type || 'daily') as any,
      completed: Boolean(nextCompleted),
      completedAt: nextCompletedAt,
      scheduleDate: task.scheduleDate || null,
      createdAt: task.createdAt,
    };
  }

  async deleteTask(id: number): Promise<boolean> {
    const [result]: any = await this.pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  async getLogs(): Promise<DailyLog[]> {
    const [rows]: any = await this.pool.execute('SELECT id, date, content FROM daily_logs');
    return rows.map((row: any) => ({
      id: row.id,
      date: row.date,
      content: row.content,
    }));
  }

  async saveLog(date: string, content: string): Promise<DailyLog> {
    await this.pool.execute(`
      INSERT INTO daily_logs (date, content)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE content = VALUES(content)
    `, [date, content]);
    
    const [rows]: any = await this.pool.execute('SELECT id, date, content FROM daily_logs WHERE date = ?', [date]);
    return {
      id: rows[0].id,
      date: rows[0].date,
      content: rows[0].content,
    };
  }

  async getReviews(): Promise<AIReview[]> {
    const [rows]: any = await this.pool.execute('SELECT id, date, summary, score FROM ai_reviews');
    return rows.map((row: any) => ({
      id: row.id,
      date: row.date,
      summary: row.summary,
      score: row.score,
    }));
  }

  async saveReview(date: string, summary: string, score: number): Promise<AIReview> {
    await this.pool.execute(`
      INSERT INTO ai_reviews (date, summary, score)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE summary = VALUES(summary), score = VALUES(score)
    `, [date, summary, score]);
    
    const [rows]: any = await this.pool.execute('SELECT id, date, summary, score FROM ai_reviews WHERE date = ?', [date]);
    return {
      id: rows[0].id,
      date: rows[0].date,
      summary: rows[0].summary,
      score: rows[0].score,
    };
  }

  async getAchievements(): Promise<Achievement[]> {
    const [rows]: any = await this.pool.execute('SELECT id, text, createdAt FROM achievements ORDER BY id DESC');
    return rows.map((row: any) => ({
      id: row.id,
      text: row.text,
      createdAt: row.createdAt,
    }));
  }

  async createAchievement(text: string): Promise<Achievement> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [existingRows]: any = await this.pool.execute('SELECT id, text, createdAt FROM achievements WHERE text = ? AND createdAt LIKE ? LIMIT 1', [text, `${todayStr}%`]);
    if (existingRows && existingRows.length > 0) {
      return {
        id: existingRows[0].id,
        text: existingRows[0].text,
        createdAt: existingRows[0].createdAt
      };
    }
    const createdAt = new Date().toISOString();
    const [result]: any = await this.pool.execute('INSERT INTO achievements (text, createdAt) VALUES (?, ?)', [text, createdAt]);
    return {
      id: Number(result.insertId),
      text,
      createdAt,
    };
  }

  async deleteAchievementByText(text: string): Promise<void> {
    await this.pool.execute('DELETE FROM achievements WHERE text = ?', [text]);
  }

  async getActivities(): Promise<Activity[]> {
    const [rows]: any = await this.pool.execute('SELECT id, type, sourceId, title, createdAt FROM activities ORDER BY id DESC');
    return rows.map((row: any) => ({
      id: row.id,
      type: row.type as any,
      sourceId: row.sourceId,
      title: row.title,
      createdAt: row.createdAt,
    }));
  }

  async createActivity(type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed', sourceId: string, title: string): Promise<Activity> {
    const [existingRows]: any = await this.pool.execute('SELECT id, type, sourceId, title, createdAt FROM activities WHERE type = ? AND sourceId = ? LIMIT 1', [type, sourceId]);
    if (existingRows && existingRows.length > 0) {
      return {
        id: existingRows[0].id,
        type: existingRows[0].type as any,
        sourceId: existingRows[0].sourceId,
        title: existingRows[0].title,
        createdAt: existingRows[0].createdAt
      };
    }
    const id = 'act_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const createdAt = new Date().toISOString();
    await this.pool.execute('INSERT INTO activities (id, type, sourceId, title, createdAt) VALUES (?, ?, ?, ?, ?)', [
      id, type, sourceId, title, createdAt
    ]);
    return {
      id,
      type,
      sourceId,
      title,
      createdAt,
    };
  }

  async deleteActivityBySourceId(sourceId: string, type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed'): Promise<void> {
    await this.pool.execute('DELETE FROM activities WHERE sourceId = ? AND type = ?', [sourceId, type]);
  }

  async getRoadmapGroups(): Promise<RoadmapGroup[]> {
    const [rows]: any = await this.pool.execute('SELECT id, name FROM roadmap_groups');
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
    }));
  }

  async getRoadmapProjects(): Promise<RoadmapProject[]> {
    const [rows]: any = await this.pool.execute('SELECT id, title, description, groupId, startDate, endDate, status, createdAt FROM roadmap_projects ORDER BY createdAt DESC');
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description || undefined,
      groupId: r.groupId,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status as 'active' | 'completed',
      createdAt: r.createdAt,
    }));
  }

  async getRoadmapTasks(): Promise<RoadmapTask[]> {
    const [rows]: any = await this.pool.execute('SELECT id, projectId, title, type, completed, completedAt, createdAt FROM roadmap_tasks');
    return rows.map((r: any) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      type: (r.type || 'learn') as 'learn' | 'project',
      completed: Boolean(r.completed),
      completedAt: r.completedAt || null,
      createdAt: r.createdAt,
    }));
  }

  async createRoadmapProject(title: string, description: string, groupId: string, startDate: string, endDate: string): Promise<RoadmapProject> {
    const id = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const createdAt = new Date().toISOString();
    const status = 'active';

    await this.pool.execute('INSERT INTO roadmap_projects (id, title, description, groupId, startDate, endDate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      id, title, description || null, groupId, startDate, endDate, status, createdAt
    ]);

    return {
      id,
      title,
      description: description || undefined,
      groupId,
      startDate,
      endDate,
      status,
      createdAt,
    };
  }

  async createRoadmapTask(projectId: string, title: string, type: 'learn' | 'project'): Promise<RoadmapTask> {
    const id = 't_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const createdAt = new Date().toISOString();
    const completed = 0;

    await this.pool.execute('INSERT INTO roadmap_tasks (id, projectId, title, type, completed, completedAt, createdAt) VALUES (?, ?, ?, ?, ?, NULL, ?)', [
      id, projectId, title, type, completed, createdAt
    ]);

    return {
      id,
      projectId,
      title,
      type,
      completed: false,
      completedAt: null,
      createdAt,
    };
  }

  async toggleRoadmapTask(id: string, completed?: boolean): Promise<RoadmapTask | null> {
    const [rows]: any = await this.pool.execute('SELECT id, projectId, title, type, completed, completedAt, createdAt FROM roadmap_tasks WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return null;
    const task = rows[0];

    const nextCompleted = completed !== undefined ? (completed ? 1 : 0) : (task.completed === 1 ? 0 : 1);
    const nextCompletedAt = nextCompleted === 1 ? new Date().toISOString() : null;

    await this.pool.execute('UPDATE roadmap_tasks SET completed = ?, completedAt = ? WHERE id = ?', [nextCompleted, nextCompletedAt, id]);

    if (nextCompleted === 1 && task.completed === 0) {
      await this.createActivity('roadmap_step_completed', task.id, task.title);
      await this.createAchievement(`Completed roadmap step: ${task.title}`);
    } else if (nextCompleted === 0 && task.completed === 1) {
      await this.deleteActivityBySourceId(task.id, 'roadmap_step_completed');
      await this.deleteAchievementByText(`Completed roadmap step: ${task.title}`);
    }

    // Check Auto-completion
    const [siblingTasks]: any = await this.pool.execute('SELECT completed FROM roadmap_tasks WHERE projectId = ?', [task.projectId]);
    if (siblingTasks.length > 0 && siblingTasks.every((t: any) => t.completed === 1)) {
      const [projects]: any = await this.pool.execute('SELECT id, title, status FROM roadmap_projects WHERE id = ?', [task.projectId]);
      if (projects && projects.length > 0 && projects[0].status !== 'completed') {
        const project = projects[0];
        await this.pool.execute("UPDATE roadmap_projects SET status = 'completed' WHERE id = ?", [task.projectId]);

        await this.createActivity('roadmap_project_completed', project.id, project.title);
        await this.createAchievement(`Completed roadmap: ${project.title}`);
      }
    }

    return {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      type: (task.type || 'learn') as 'learn' | 'project',
      completed: Boolean(nextCompleted),
      completedAt: nextCompletedAt,
      createdAt: task.createdAt,
    };
  }

  async completeRoadmapProject(id: string): Promise<RoadmapProject | null> {
    const [rows]: any = await this.pool.execute('SELECT id, title, description, groupId, startDate, endDate, status, createdAt FROM roadmap_projects WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return null;
    const project = rows[0];

    if (project.status !== 'completed') {
      await this.pool.execute("UPDATE roadmap_projects SET status = 'completed' WHERE id = ?", [id]);
      await this.createActivity('roadmap_project_completed', project.id, project.title);
      await this.createAchievement(`Completed roadmap: ${project.title}`);
    }

    return {
      id: project.id,
      title: project.title,
      description: project.description || undefined,
      groupId: project.groupId,
      startDate: project.startDate,
      endDate: project.endDate,
      status: 'completed',
      createdAt: project.createdAt,
    };
  }
}

// ----------------------------------------------------
// DATABASE SELECTOR & DYNAMIC RUNTIME DELEGATOR
// ----------------------------------------------------
export class DelegatingDBClient implements DatabaseClient {
  private activeClient: DatabaseClient;
  private currentEngine: 'sqlite' | 'mysql' | 'json' = 'sqlite';
  private currentConfig: any = {};

  constructor() {
    this.activeClient = new JsonDBClient();
  }

  getCurrentEngine() {
    return this.currentEngine;
  }

  getCurrentConfig() {
    return this.currentConfig;
  }

  async setEngine(engine: 'sqlite' | 'mysql' | 'json', config?: any): Promise<{ success: boolean; error?: string }> {
    let client: DatabaseClient;
    if (engine === 'mysql') {
      client = new MySQLDBClient(config);
    } else if (engine === 'sqlite') {
      try {
        const sqlite = requireHelper('node:sqlite');
        if (sqlite && typeof sqlite.DatabaseSync === 'function') {
          client = new SQLiteDBClient(sqlite.DatabaseSync);
        } else {
          return { success: false, error: 'DatabaseSync functionality is not available in node:sqlite on this runtime environment.' };
        }
      } catch (e: any) {
        return { success: false, error: 'Failed to request node:sqlite library: ' + e.message };
      }
    } else {
      client = new JsonDBClient();
    }

    try {
      console.log(`Dynamic DB Switch: Bootstrapping engine [${engine}]...`);
      await client.init();
      
      // Successfully initialized without throwing! Update state
      this.activeClient = client;
      this.currentEngine = engine;
      this.currentConfig = config || {};
      
      // Persist user selected configuration to filesystem so it survives restarts
      try {
        fs.writeFileSync(
          path.join(process.cwd(), 'db_config.json'),
          JSON.stringify({ engine, ...this.currentConfig }, null, 2),
          'utf-8'
        );
      } catch (writeErr) {
        console.error('Error persisting db_config.json path contents:', writeErr);
      }
      
      return { success: true };
    } catch (err: any) {
      console.error(`Failed to dynamic-switch or initialize the [${engine}] engine:`, err);
      return { success: false, error: err.message || 'Database server connection handshake failed.' };
    }
  }

  async init() {
    // Attempt to load previously saved configuration
    const configPath = path.join(process.cwd(), 'db_config.json');
    let loadedConfig: any = null;
    if (fs.existsSync(configPath)) {
      try {
        loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {
        console.warn('Stale or unreadable db_config.json found, skipping load.', e);
      }
    }

    if (loadedConfig && loadedConfig.engine) {
      const { engine, ...rest } = loadedConfig;
      const res = await this.setEngine(engine, rest);
      if (res.success) {
        console.log(`Configured engine [${engine}] restored successfully from config file.`);
        return;
      } else {
        console.warn(`Restoring saved engine [${engine}] failed on startup. Falling back to default heuristics...`);
      }
    }

    // Default connection heuristic
    const useMySQL = Boolean(process.env.MYSQL_HOST || process.env.MYSQL_URL || process.env.DATABASE_URL);
    if (useMySQL) {
      console.log('Detected default MySQL credentials in environment. Initializing default MySQL client...');
      const defaultMySqlConfig = {
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        uri: process.env.MYSQL_URL || process.env.DATABASE_URL
      };
      const res = await this.setEngine('mysql', defaultMySqlConfig);
      if (res.success) return;
    }

    // Try resolving sqlite
    try {
      const res = await this.setEngine('sqlite');
      if (res.success) return;
    } catch (e) {}

    // Ultimate backup fallback
    console.warn('Unable to bind SQLite or MySQL databases. Activating portable JSON Client fallback...');
    this.activeClient = new JsonDBClient();
    await this.activeClient.init();
    this.currentEngine = 'json';
    this.currentConfig = {};
  }

  // DatabaseClient Delegations
  async getTasks() { return this.activeClient.getTasks(); }
  async createTask(title: string, category: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'scheduled' = 'daily', scheduleDate: string | null = null) {
    return this.activeClient.createTask(title, category, type, scheduleDate);
  }
  async toggleTask(id: number) { return this.activeClient.toggleTask(id); }
  async deleteTask(id: number) { return this.activeClient.deleteTask(id); }
  async getLogs() { return this.activeClient.getLogs(); }
  async saveLog(date: string, content: string) { return this.activeClient.saveLog(date, content); }
  async getReviews() { return this.activeClient.getReviews(); }
  async saveReview(date: string, summary: string, score: number) { return this.activeClient.saveReview(date, summary, score); }
  async getAchievements() { return this.activeClient.getAchievements(); }
  async createAchievement(text: string) { return this.activeClient.createAchievement(text); }
  async deleteAchievementByText(text: string) { return this.activeClient.deleteAchievementByText(text); }
  async getActivities() { return this.activeClient.getActivities(); }
  async createActivity(type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed', sourceId: string, title: string) {
    return this.activeClient.createActivity(type, sourceId, title);
  }
  async deleteActivityBySourceId(sourceId: string, type: 'task_completed' | 'roadmap_step_completed' | 'roadmap_project_completed') {
    return this.activeClient.deleteActivityBySourceId(sourceId, type);
  }

  async getRoadmapGroups() { return this.activeClient.getRoadmapGroups(); }
  async getRoadmapProjects() { return this.activeClient.getRoadmapProjects(); }
  async getRoadmapTasks() { return this.activeClient.getRoadmapTasks(); }
  async createRoadmapProject(title: string, description: string, groupId: string, startDate: string, endDate: string) {
    return this.activeClient.createRoadmapProject(title, description, groupId, startDate, endDate);
  }
  async createRoadmapTask(projectId: string, title: string, type: 'learn' | 'project') {
    return this.activeClient.createRoadmapTask(projectId, title, type);
  }
  async toggleRoadmapTask(id: string, completed?: boolean) {
    return this.activeClient.toggleRoadmapTask(id, completed);
  }
  async completeRoadmapProject(id: string) {
    return this.activeClient.completeRoadmapProject(id);
  }
}

// Global active store instance
export const dbStore = new DelegatingDBClient();

// Initialize on bootup asynchronously
dbStore.init().catch((err) => {
  console.error('Critical Database bootstrapped initialize failure:', err);
});
