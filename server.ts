import express from 'express';
import * as path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbStore } from './src/db';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;

// Lazy initialization of Gemini API Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in the environment secrets. Please configure it in Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

app.use(express.json());

// ----------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------

// GET /api/history - Return current states & timeline
app.get('/api/history', async (req, res) => {
  try {
    const tasks = await dbStore.getTasks();
    const achievements = await dbStore.getAchievements();
    const logs = await dbStore.getLogs();
    const reviews = await dbStore.getReviews();

    res.json({
      tasks,
      achievements,
      logs,
      reviews,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tasks - Create a task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, category } = req.body;
    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required' });
    }
    const task = await dbStore.createTask(title, category);
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/tasks/:id - Toggle task complete
app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const task = await dbStore.toggleTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Rule: "Completing a task automatically creates an achievement: 'Completed: {task.title}'"
    if (task.completed) {
      await dbStore.createAchievement(`Completed: ${task.title}`);
    }

    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/tasks/:id - Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const success = await dbStore.deleteTask(id);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// ROADMAP ENDPOINTS
// ----------------------------------------------------

// GET /api/roadmap/groups
app.get('/api/roadmap/groups', async (req, res) => {
  try {
    const groups = await dbStore.getRoadmapGroups();
    res.json(groups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/roadmap/projects - Get Projects with nested tasks and progress
app.get('/api/roadmap/projects', async (req, res) => {
  try {
    const projects = await dbStore.getRoadmapProjects();
    const tasks = await dbStore.getRoadmapTasks();
    const response = projects.map(p => {
      const projectTasks = tasks.filter(t => t.projectId === p.id);
      const total = projectTasks.length;
      const done = projectTasks.filter(t => t.completed).length;
      return {
        ...p,
        dateRange: `${p.startDate} → ${p.endDate}`,
        progress: { done, total },
        tasks: projectTasks
      };
    });
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/roadmap/projects - Create a roadmap project
app.post('/api/roadmap/projects', async (req, res) => {
  try {
    const { title, description, groupId, startDate, endDate } = req.body;
    if (!title || !groupId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Title, Category Group, Start Date and End Date are required' });
    }
    const project = await dbStore.createRoadmapProject(title, description || '', groupId, startDate, endDate);
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/roadmap/tasks - Add a task under project
app.post('/api/roadmap/tasks', async (req, res) => {
  try {
    const { projectId, title, type } = req.body;
    if (!projectId || !title) {
      return res.status(400).json({ error: 'ProjectId and Title are required' });
    }
    const subtaskType = (type === 'project' || type === 'learn') ? type : 'learn';
    const task = await dbStore.createRoadmapTask(projectId, title, subtaskType);
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/roadmap/tasks/:id - Toggle/Set task completion status
app.patch('/api/roadmap/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { completed } = req.body;
    const task = await dbStore.toggleRoadmapTask(id, completed);
    if (!task) {
      return res.status(404).json({ error: 'Roadmap task not found' });
    }
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/roadmap/projects/:id/complete - Manually complete project
app.patch('/api/roadmap/projects/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await dbStore.completeRoadmapProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/checkin - Save daily log & trigger AI review
app.post('/api/checkin', async (req, res) => {
  try {
    const { date, content } = req.body;
    if (!date || !content) {
      return res.status(400).json({ error: 'Date (YYYY-MM-DD) and content are required' });
    }

    // Save check-in log
    const log = await dbStore.saveLog(date, content);

    // Business Logic: Trigger AI Review automatically after log submission
    let aiReview = null;
    let aiError = null;
    try {
      aiReview = await runAiReview(date, content);
    } catch (err: any) {
      console.error('Triggered auto AI review failed:', err.message);
      aiError = err.message;
    }

    res.json({
      success: true,
      log,
      review: aiReview,
      aiError,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai-review - Trigger review on demand or re-run
app.post('/api/ai-review', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Find if logs exists for this date
    const logs = await dbStore.getLogs();
    const logForDate = logs.find((l) => l.date === date);

    if (!logForDate || !logForDate.content.trim()) {
      return res.status(400).json({ error: `No writeup check-in logs found for date ${date}. Please add a log first.` });
    }

    const review = await runAiReview(date, logForDate.content);
    res.json({ success: true, review });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/db/config - Retrieve dynamic database status & connection state
app.get('/api/db/config', async (req, res) => {
  try {
    const store = dbStore as any;
    res.json({
      engine: store.getCurrentEngine(),
      config: store.getCurrentConfig() || {}
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/db/config - Save configuration and dynamically switch DB engine
app.post('/api/db/config', async (req, res) => {
  try {
    const { engine, config } = req.body;
    if (!engine || !['sqlite', 'mysql', 'json'].includes(engine)) {
      return res.status(400).json({ error: 'Selected database engine must be sqlite, mysql, or json' });
    }

    const store = dbStore as any;
    const result = await store.setEngine(engine, config);
    if (result.success) {
      res.json({ success: true, engine });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// AI REVIEW EXECUTION HELPER (GEMINI SDK)
// ----------------------------------------------------
async function runAiReview(date: string, logContent: string) {
  const ai = getGeminiClient();

  // Create full prompt for productivity reviewer
  const prompt = `You are a strict, objective, and neutral productivity reviewer. 
Analyze the user's daily check-in log and provide an honest, no-sugarcoating review of their accomplishments, gaps, and an overall productivity score.

Log writer's entry: "${logContent}"

Your review must be returned as valid structured JSON.
Be realistic, neutral, and direct. Do not exaggerate praise. A score of 10 must be exceptionally hard to get (only reserve for massive, highly structured outputs). Average work should score 5-7. If they did literally nothing, score appropriately lower.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: 'A brief, realistic summary outlining what was completed, skipped, or failed to achieve.',
          },
          positives: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Literal concrete accomplishments or focus highlights. Avoid empty general praise.',
          },
          missing: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Constructive list of unaccomplished aims, gaps, or areas for focus.',
          },
          score: {
            type: Type.INTEGER,
            description: 'The strict Productivity Score from 1 to 10 (neutral assessment).',
          },
        },
        required: ['summary', 'positives', 'missing', 'score'],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error('Empirical assessment failed: Received empty response from AI engine.');
  }

  // Parse response structure
  const rawJson = JSON.parse(responseText.trim());

  // Convert to Markdown representation to persist in SQL-compatible db schema 'summary' column
  const formattedSummary = `### Summary
${rawJson.summary}

### Positive Highlights
${rawJson.positives.map((p: string) => `- ${p}`).join('\n')}

### Areas for Focus / Gaps
${rawJson.missing.map((m: string) => `- ${m}`).join('\n')}`;

  const score = parseInt(rawJson.score, 10) || 5;

  // Save/Overwrite review on table
  const savedReview = dbStore.saveReview(date, formattedSummary, score);
  return savedReview;
}

// ----------------------------------------------------
// BOOTSTRAP EXTRAS & VITE MIDDLEWARE
// ----------------------------------------------------
async function startServer() {
  // Integrate Vite dev server when not in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server starting up successfully! Ingress routed via http://0.0.0.0:${PORT}`);
  });
}

startServer();
