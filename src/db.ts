import * as fs from 'fs';
import * as path from 'path';
import { Task, DailyLog, AIReview, Achievement } from './types';

const DB_FILE_PATH = path.join(process.cwd(), 'productivity.db');
const JSON_BACKUP_PATH = path.join(process.cwd(), 'productivity.db.json');

// Interface for db methods so we have a unified client
interface DatabaseClient {
  init(): void;
  getTasks(): Task[];
  createTask(title: string, category: string): Task;
  toggleTask(id: number): Task | null;
  deleteTask(id: number): boolean;
  getLogs(): DailyLog[];
  saveLog(date: string, content: string): DailyLog;
  getReviews(): AIReview[];
  saveReview(date: string, summary: string, score: number): AIReview;
  getAchievements(): Achievement[];
  createAchievement(text: string): Achievement;
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
  } = {
    tasks: [],
    daily_logs: [],
    ai_reviews: [],
    achievements: [],
  };

  init() {
    if (fs.existsSync(JSON_BACKUP_PATH)) {
      try {
        const fileContent = fs.readFileSync(JSON_BACKUP_PATH, 'utf-8');
        this.data = JSON.parse(fileContent);
        // Ensure all arrays exist
        this.data.tasks = this.data.tasks || [];
        this.data.daily_logs = this.data.daily_logs || [];
        this.data.ai_reviews = this.data.ai_reviews || [];
        this.data.achievements = this.data.achievements || [];
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

  getTasks(): Task[] {
    return this.data.tasks;
  }

  createTask(title: string, category: string): Task {
    const newTask: Task = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title,
      category,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.data.tasks.push(newTask);
    this.save();
    return newTask;
  }

  toggleTask(id: number): Task | null {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) return null;
    task.completed = !task.completed;
    this.save();
    return task;
  }

  deleteTask(id: number): boolean {
    const initialLen = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    const deleted = this.data.tasks.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  getLogs(): DailyLog[] {
    return this.data.daily_logs;
  }

  saveLog(date: string, content: string): DailyLog {
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

  getReviews(): AIReview[] {
    return this.data.ai_reviews;
  }

  saveReview(date: string, summary: string, score: number): AIReview {
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

  getAchievements(): Achievement[] {
    return this.data.achievements;
  }

  createAchievement(text: string): Achievement {
    const newAchievement: Achievement = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      text,
      createdAt: new Date().toISOString(),
    };
    this.data.achievements.push(newAchievement);
    this.save();
    return newAchievement;
  }
}

// ----------------------------------------------------
// IMPLEMENTATION B: Node Native SQLite Client
// ----------------------------------------------------
class SQLiteDBClient implements DatabaseClient {
  private db: any = null;

  constructor(private DatabaseSyncClass: any) {}

  init() {
    this.db = new this.DatabaseSyncClass(DB_FILE_PATH);

    // Create necessary tables if not exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
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

    console.log('node:sqlite tables verified/created successfully.');
  }

  getTasks(): Task[] {
    const query = this.db.prepare('SELECT id, title, category, completed, createdAt FROM tasks ORDER BY id DESC');
    const rows = query.all();
    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      completed: Boolean(row.completed),
      createdAt: row.createdAt,
    }));
  }

  createTask(title: string, category: string): Task {
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare('INSERT INTO tasks (title, category, completed, createdAt) VALUES (?, ?, 0, ?)');
    const result = stmt.run(title, category);
    return {
      id: Number(result.lastInsertRowid),
      title,
      category,
      completed: false,
      createdAt,
    };
  }

  toggleTask(id: number): Task | null {
    // Get current state
    const selectStmt = this.db.prepare('SELECT id, title, category, completed, createdAt FROM tasks WHERE id = ?');
    const task = selectStmt.get(id);
    if (!task) return null;

    const nextCompleted = task.completed === 1 ? 0 : 1;
    const updateStmt = this.db.prepare('UPDATE tasks SET completed = ? WHERE id = ?');
    updateStmt.run(nextCompleted, id);

    return {
      id: task.id,
      title: task.title,
      category: task.category,
      completed: Boolean(nextCompleted),
      createdAt: task.createdAt,
    };
  }

  deleteTask(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getLogs(): DailyLog[] {
    const query = this.db.prepare('SELECT id, date, content FROM daily_logs');
    return query.all().map((row: any) => ({
      id: row.id,
      date: row.date,
      content: row.content,
    }));
  }

  saveLog(date: string, content: string): DailyLog {
    // UPSERT or Insert-or-replace
    const stmt = this.db.prepare(`
      INSERT INTO daily_logs (date, content)
      VALUES (?, ?)
      ON CONFLICT(date) DO UPDATE SET content = excluded.content
    `);
    const result = stmt.run(date, content);

    // Get the log to return
    const getStmt = this.db.prepare('SELECT id, date, content FROM daily_logs WHERE date = ?');
    const row = getStmt.get(date);
    return {
      id: row.id,
      date: row.date,
      content: row.content,
    };
  }

  getReviews(): AIReview[] {
    const query = this.db.prepare('SELECT id, date, summary, score FROM ai_reviews');
    return query.all().map((row: any) => ({
      id: row.id,
      date: row.date,
      summary: row.summary,
      score: row.score,
    }));
  }

  saveReview(date: string, summary: string, score: number): AIReview {
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

  getAchievements(): Achievement[] {
    const query = this.db.prepare('SELECT id, text, createdAt FROM achievements ORDER BY id DESC');
    return query.all().map((row: any) => ({
      id: row.id,
      text: row.text,
      createdAt: row.createdAt,
    }));
  }

  createAchievement(text: string): Achievement {
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare('INSERT INTO achievements (text, createdAt) VALUES (?, ?)');
    const result = stmt.run(text, createdAt);
    return {
      id: Number(result.lastInsertRowid),
      text,
      createdAt,
    };
  }
}

import { createRequire } from 'module';
const requireHelper = createRequire(path.join(process.cwd(), 'dummy.js'));

// ----------------------------------------------------
// DATABASE SELECTOR WITH RESILIENT FALLBACK
// ----------------------------------------------------
let activeClient: DatabaseClient;

try {
  // Try importing Node 22 database engine synchronously
  const sqlite = requireHelper('node:sqlite');
  if (sqlite && typeof sqlite.DatabaseSync === 'function') {
    console.log('Successfully loaded node:sqlite. Initializing SQLite Client...');
    const client = new SQLiteDBClient(sqlite.DatabaseSync);
    // Initialize inside the try-catch block to handle write/lock or runtime failures
    client.init();
    activeClient = client;
  } else {
    throw new Error('DatabaseSync is not a function or is unavailable on this Node runtime.');
  }
} catch (e) {
  console.warn('node:sqlite is not fully supported or failed to initialize. Falling back to resilient portable JSON database.', e);
  const fallback = new JsonDBClient();
  fallback.init();
  activeClient = fallback;
}

export const dbStore = activeClient;
