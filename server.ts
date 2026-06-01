import express from 'express';
import * as path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbStore } from './src/db';
import { GoogleGenAI, Type } from '@google/genai';
import { sendMail } from './src/lib/email/resend';
import { runTaskCycleCheck, getCycleRange, getTodayString } from './src/lib/tasks-cycle';


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
    await runTaskCycleCheck();
    const tasks = await dbStore.getTasks();
    const achievements = await dbStore.getAchievements();
    const logs = await dbStore.getLogs();
    const reviews = await dbStore.getReviews();
    const activities = await dbStore.getActivities();

    res.json({
      tasks,
      achievements,
      logs,
      reviews,
      activities,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tasks - Create a task
app.post('/api/tasks', async (req, res) => {
  try {
    await runTaskCycleCheck();
    const { title, category, type, scheduleDate } = req.body;
    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required' });
    }
    const taskType = type || 'daily';
    const sDate = scheduleDate || null;
    const { start, end } = getCycleRange(taskType, getTodayString(), sDate);
    const task = await dbStore.createTask(title, category, taskType, sDate, start, end, 'active');
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
      await dbStore.createActivity('task_completed', String(task.id), task.title);
    } else {
      await dbStore.deleteAchievementByText(`Completed: ${task.title}`);
      await dbStore.deleteActivityBySourceId(String(task.id), 'task_completed');
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

    // Trigger daily check-in email system (non-blocking, async background task)
    processCheckInEmailFlow(date, content).catch(err => {
      console.error('Background check-in email dispatch error:', err);
    });

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

  // Retrieve verifiable evidence for this specific date
  const allAchievements = await dbStore.getAchievements();
  const allActivities = await dbStore.getActivities();
  const allTasks = await dbStore.getTasks();

  const dayAchievements = allAchievements.filter(ach => ach.createdAt.startsWith(date));
  const dayActivities = allActivities.filter(act => act.createdAt.startsWith(date));

  // Daily task calculations
  const dailyTasks = allTasks.filter(t => {
    return t.type === 'daily' || (t.type === 'scheduled' && t.scheduleDate === date);
  });
  const dailyTasksTotal = dailyTasks.length;
  const dailyTasksCompleted = dailyTasks.filter(t => t.completed && t.completedAt && t.completedAt.startsWith(date)).length;

  const dailyCompletionRate = dailyTasksTotal > 0 ? (dailyTasksCompleted / dailyTasksTotal) : 1.0;
  const taskCompletionScore = dailyCompletionRate * 10;

  // Bonus task completions
  const weeklyCompletedToday = allTasks.filter(t => t.type === 'weekly' && t.completed && t.completedAt && t.completedAt.startsWith(date)).length;
  const monthlyCompletedToday = allTasks.filter(t => t.type === 'monthly' && t.completed && t.completedAt && t.completedAt.startsWith(date)).length;
  const yearlyCompletedToday = allTasks.filter(t => t.type === 'yearly' && t.completed && t.completedAt && t.completedAt.startsWith(date)).length;

  const completedRoadmapSteps = dayActivities.filter(act => act.type === 'roadmap_step_completed');
  const completedRoadmapProjects = dayActivities.filter(act => act.type === 'roadmap_project_completed');

  const scheduledCompletedEarly = allTasks.filter(t => {
    return t.type === 'scheduled' && 
           t.completed && 
           t.completedAt && 
           t.completedAt.startsWith(date) && 
           t.scheduleDate && 
           t.scheduleDate > date;
  }).length;

  // Compute Bonus Score deterministically
  let bonusCalc = 0;
  bonusCalc += (weeklyCompletedToday * 0.5);
  bonusCalc += (monthlyCompletedToday * 1.0);
  bonusCalc += (yearlyCompletedToday * 2.0);
  bonusCalc += (completedRoadmapSteps.length * 0.5);
  bonusCalc += (completedRoadmapProjects.length * 1.0);
  bonusCalc += (scheduledCompletedEarly * 0.5);

  const bonusScore = Math.min(5.0, bonusCalc);

  const achievementsStr = dayAchievements.map(a => `- Achievement Unlocked: ${a.text}`).join('\n') || 'None';
  const tasksStr = dailyTasks.map(t => `- [${t.completed ? 'COMPLETED' : 'INCOMPLETE'}] ${t.title}`).join('\n') || 'None';
  const stepsStr = completedRoadmapSteps.map(s => `- Completed Roadmap Step: ${s.title}`).join('\n') || 'None';
  const projectsStr = completedRoadmapProjects.map(p => `- Completed Roadmap Project: ${p.title}`).join('\n') || 'None';

  const statsInput = {
    daily: {
      total: dailyTasksTotal,
      completed: dailyTasksCompleted
    },
    weeklyCompletedToday,
    monthlyCompletedToday,
    yearlyCompletedToday,
    roadmapCompletedToday: completedRoadmapSteps.length + completedRoadmapProjects.length,
    scheduledCompletedEarly,
    dailyLog: logContent
  };

  const prompt = `You are a strict, objective, and neutral productivity reviewer. 
Analyze the user's daily check-in log and contrast it with system-tracked evidence for date: ${date}.

--- CRITICAL SYSTEM TRACKED DATA (JSON FORMAT) ---
${JSON.stringify(statsInput, null, 2)}

--- OTHER SYSTEM EVENTS ---
Completed Roadmap Steps today:
${stepsStr}

Completed Roadmap Projects today:
${projectsStr}

Achievements unlocked today:
${achievementsStr}

--- USER CHECK-IN LOG WRITEUP ---
"${logContent}"

--- REVIEW DIRECTIVES & AUDIT RULES ---
1. Contrast claims in the check-in log writeup with actual system-tracked activities and achievements completed today.
2. Emphasize tracking evidence: check for "unsubstantiated claims" where the user claims to have done something but no matching evidence was found.
3. You must evaluate the quality of the daily check-in log (checkinScore) from 0 to 10 based on:
   - Effort (is the log detailed and descriptive?)
   - Consistency (did they mention continuous actions?)
   - Meaningful work (was actual, non-trivial progress discussed?)
   - Reflection quality (acknowledged failures, identified gaps, or analyzed bottlenecks)
4. Populate 'summary', 'wins', 'improvements', and 'tomorrowFocus' arrays.
5. Provide the 'checkinScore' as an integer or float from 0 to 10 representing the check-in log validation.
Your response must be returned as valid structured JSON according to the schema.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: 'A brief, realistic summary outlining what was completed, skipped, or failed to achieve. Highlight verified vs unverified claims.',
          },
          wins: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of verified wins or successes today.',
          },
          improvements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of constructive improvements, gaps, or bottlenecks.',
          },
          tomorrowFocus: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Key items to focus on tomorrow based on today\'s achievements and reflections.',
          },
          checkinScore: {
            type: Type.NUMBER,
            description: 'The Quality Rating of the written check-in progress log on a scale from 0 to 10 (0=empty or meaningless, 10=exceptional detail, self-critique, and reflection).',
          }
        },
        required: ['summary', 'wins', 'improvements', 'tomorrowFocus', 'checkinScore'],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error('Empirical assessment failed: Received empty response from AI engine.');
  }

  // Parse response structure
  const rawJson = JSON.parse(responseText.trim());

  const checkinScore = Math.max(0, Math.min(10, Number(rawJson.checkinScore) || 5));
  // Daily Score Formula: (taskCompletionScore * 0.7) + (checkinScore * 0.3)
  const dailyScore = parseFloat(((taskCompletionScore * 0.7) + (checkinScore * 0.3)).toFixed(1));

  // Convert to Markdown representation to persist in SQL-compatible db schema 'summary' column
  const formattedSummary = `### Summary
${rawJson.summary}

### Daily Responsibilities Breakdown
- Daily tasks completed: ${dailyTasksCompleted}/${dailyTasksTotal}
- Task completion rate: ${Math.round(dailyCompletionRate * 100)}% -> ${(taskCompletionScore).toFixed(1)}/10 points (70% weight)
- Check-in evaluation: ${(checkinScore).toFixed(1)}/10 points (30% weight)
- **DAILY SCORE**: ${dailyScore.toFixed(1)} / 10

### Bonus Progress Earned (+${bonusScore.toFixed(1)} / 5.0)
- Weekly tasks completed today: ${weeklyCompletedToday} (+${(weeklyCompletedToday * 0.5).toFixed(1)} bonus)
- Monthly tasks completed today: ${monthlyCompletedToday} (+${(monthlyCompletedToday * 1.0).toFixed(1)} bonus)
- Yearly tasks completed today: ${yearlyCompletedToday} (+${(yearlyCompletedToday * 2.0).toFixed(1)} bonus)
- Roadmap steps completed: ${completedRoadmapSteps.length} (+${(completedRoadmapSteps.length * 0.5).toFixed(1)} bonus)
- Roadmap projects completed: ${completedRoadmapProjects.length} (+${(completedRoadmapProjects.length * 1.0).toFixed(1)} bonus)
- Pre-scheduled tasks completed early: ${scheduledCompletedEarly} (+${(scheduledCompletedEarly * 0.5).toFixed(1)} bonus)

### Wins Today
${rawJson.wins.map((w: string) => `- ${w}`).join('\n') || 'None'}

### Areas for Focus / Gaps
${rawJson.improvements.map((m: string) => `- ${m}`).join('\n') || 'None'}

### Focus List for Tomorrow
${rawJson.tomorrowFocus.map((f: string) => `- ${f}`).join('\n') || 'None'}`;

  // Save/Overwrite review on table
  const savedReview = await dbStore.saveReview(date, formattedSummary, dailyScore, bonusScore);
  return savedReview;
}

// ----------------------------------------------------
// AI DAILY CHECK-IN EMAIL SYSTEM CODES
// ----------------------------------------------------

// Email format and validation helper
function validateRecipients(emails: any): string[] {
  if (!Array.isArray(emails)) return [];
  const validEmails = new Set<string>();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  for (const email of emails) {
    if (typeof email === 'string') {
      const trimmed = email.trim();
      if (trimmed && emailRegex.test(trimmed)) {
        validEmails.add(trimmed);
      }
    }
  }
  
  return Array.from(validEmails).slice(0, 10);
}

// AI email report builder
async function generateEmailReport(date: string, logContent: string) {
  try {
    const ai = getGeminiClient();
    
    // Retrieve verifiable tracked activities for context
    const allAchievements = await dbStore.getAchievements();
    const allActivities = await dbStore.getActivities();
    const allTasks = await dbStore.getTasks();

    const dayAchievements = allAchievements.filter(ach => ach.createdAt.startsWith(date));
    const dayActivities = allActivities.filter(act => act.createdAt.startsWith(date));

    // Daily task calculations
    const dailyTasks = allTasks.filter(t => {
      return t.type === 'daily' || (t.type === 'scheduled' && t.scheduleDate === date);
    });
    const dailyTasksTotal = dailyTasks.length;
    const dailyTasksCompleted = dailyTasks.filter(t => t.completed && t.completedAt && t.completedAt.startsWith(date)).length;

    const dailyCompletionRate = dailyTasksTotal > 0 ? (dailyTasksCompleted / dailyTasksTotal) : 1.0;
    const taskCompletionScore = dailyCompletionRate * 10;

    // Bonus task completions
    const weeklyCompletedToday = allTasks.filter(t => t.type === 'weekly' && t.completed && t.completedAt && t.completedAt.startsWith(date)).length;
    const monthlyCompletedToday = allTasks.filter(t => t.type === 'monthly' && t.completed && t.completedAt && t.completedAt.startsWith(date)).length;
    const yearlyCompletedToday = allTasks.filter(t => t.type === 'yearly' && t.completed && t.completedAt && t.completedAt.startsWith(date)).length;

    const completedRoadmapSteps = dayActivities.filter(act => act.type === 'roadmap_step_completed');
    const completedRoadmapProjects = dayActivities.filter(act => act.type === 'roadmap_project_completed');

    const scheduledCompletedEarly = allTasks.filter(t => {
      return t.type === 'scheduled' && 
             t.completed && 
             t.completedAt && 
             t.completedAt.startsWith(date) && 
             t.scheduleDate && 
             t.scheduleDate > date;
    }).length;

    // Compute Bonus Score deterministically
    let bonusCalc = 0;
    bonusCalc += (weeklyCompletedToday * 0.5);
    bonusCalc += (monthlyCompletedToday * 1.0);
    bonusCalc += (yearlyCompletedToday * 2.0);
    bonusCalc += (completedRoadmapSteps.length * 0.5);
    bonusCalc += (completedRoadmapProjects.length * 1.0);
    bonusCalc += (scheduledCompletedEarly * 0.5);

    const bonusScore = Math.min(5.0, bonusCalc);

    const achievementsStr = dayAchievements.map(a => `- ${a.text}`).join('\n') || 'None';
    const tasksStr = dailyTasks.map(t => `- [${t.completed ? 'COMPLETED' : 'INCOMPLETE'}] ${t.title}`).join('\n') || 'None';
    const stepsStr = completedRoadmapSteps.map(s => `- ${s.title}`).join('\n') || 'None';

    const prompt = `You are a strict, objective, and neutral productivity coach.
Analyze the user's progress for today (${date}) and outline a motivating, structured daily email progress report.
Contrast the user's check-in log with the system verified raw evidence:
- Verifiable Daily Tasks:
${tasksStr}
- Verifiable Roadmap steps completed:
${stepsStr}
- Accomplishments unlocked:
${achievementsStr}

User's log content: "${logContent}"

Tone: Motivational but honest (no fake praise, call out gaps/unsubstantiated claims, and focus on progress/discipline).
Your output must be returned as valid structured JSON according to the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: {
              type: Type.STRING,
              description: 'An engaging, motivational subject line for the progress email report.'
            },
            summary: {
              type: Type.STRING,
              description: 'A brief 2-3 sentence overview of today\'s efforts, showing realistic evaluation.'
            },
            wins: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of verifiable key achievements and completed items today.'
            },
            improvements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Constructive suggestions for improvement, highlighting gaps between logs and verified activities.'
            },
            checkinScore: {
              type: Type.NUMBER,
              description: 'A score from 0 to 10 evaluating the quality, depth, and honesty of the check-in log reflection.'
            },
            motivational_message: {
              type: Type.STRING,
              description: 'A candid, encouraging coach commentary about building consistency.'
            },
            tomorrow_focus: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Tactical next focus tasks for tomorrow.'
            }
          },
          required: ['subject', 'summary', 'wins', 'improvements', 'checkinScore', 'motivational_message', 'tomorrow_focus']
        }
      }
    });

    if (!response.text) {
      throw new Error('Received empty response from Gemini API.');
    }

    const reportJson = JSON.parse(response.text.trim());
    
    const checkinScore = Math.max(0, Math.min(10, Number(reportJson.checkinScore) || 5));
    const dailyScore = parseFloat(((taskCompletionScore * 0.7) + (checkinScore * 0.3)).toFixed(1));

    return {
      subject: reportJson.subject || `Progress Report for ${date}`,
      summary: reportJson.summary || '',
      wins: reportJson.wins || [],
      improvements: reportJson.improvements || [],
      dailyScore,
      bonusScore,
      rate: Math.round(dailyCompletionRate * 100),
      motivational_message: reportJson.motivational_message || '',
      tomorrow_focus: reportJson.tomorrowFocus || reportJson.tomorrow_focus || []
    };
  } catch (err: any) {
    console.error('Error generating AI email report, leveraging fallback:', err.message);
    return {
      subject: `Daily Progress Report for ${date}`,
      summary: `Check-in details submitted successfully. Log writeup says: "${logContent}"`,
      wins: ['User successfully submitted manual daily check-in log.'],
      improvements: ['Verify that automated AI integrations are fully configured.'],
      dailyScore: 5.0,
      bonusScore: 0.0,
      rate: 100,
      motivational_message: 'Keep showing up! Logging your days is a powerful ritual of discipline. Keep logging consistent progress to build long term momentum.',
      tomorrow_focus: ['Review daily goals', 'Continue habits check-in loop']
    };
  }
}

// Background handler
async function processCheckInEmailFlow(date: string, logContent: string) {
  try {
    const settings = await dbStore.getSettings('email_recipients');
    if (!settings || !settings.value || settings.value.length === 0) {
      console.log('Daily check-in email system skipped: No recipients configured.');
      return;
    }

    const validatedRecipients = validateRecipients(settings.value);
    if (validatedRecipients.length === 0) {
      console.log('Daily check-in email system skipped: No valid recipients found.');
      return;
    }

    console.log(`Daily check-in email system started. Recipients: [${validatedRecipients.join(', ')}]`);

    const report = await generateEmailReport(date, logContent);

    const dailyScore = report.dailyScore ?? 5.0;
    const bonusScore = report.bonusScore ?? 0.0;
    const rate = report.rate ?? 100;
    const summary = report.summary ?? '';
    const wins = report.wins ?? [];
    const improvements = report.improvements ?? [];
    const coachMessage = report.motivational_message ?? '';
    const tomorrowFocus = report.tomorrow_focus ?? [];

    const winsHtml = wins.map((w: string) => `<li>${w}</li>`).join('\n');
    const improvementsHtml = improvements.map((i: string) => `<li>${i}</li>`).join('\n');
    const tomorrowFocusHtml = tomorrowFocus.map((tf: string) => `<li>${tf}</li>`).join('\n');

    const htmlContent = `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; padding: 20px;">
  <h2>Daily Progress Report - Daily Score: ${dailyScore}/10</h2>
  <p><strong>Bonus Score:</strong> +${bonusScore.toFixed(1)}</p>
  <p><strong>Task Completion Rate:</strong> ${rate}%</p>
  <p><strong>Summary / Reflection Analysis:</strong> ${summary}</p>
  <h3>Wins Today</h3>
  <ul>
    ${winsHtml || '<li>None recorded</li>'}
  </ul>
  <h3>Areas of Improvement / Bottlenecks</h3>
  <ul>
    ${improvementsHtml || '<li>Keep working consistently</li>'}
  </ul>
  <p><strong>Coach's Message:</strong> ${coachMessage}</p>
  <h3>Tomorrow's Focus</h3>
  <ul>
    ${tomorrowFocusHtml || '<li>Review daily routine</li>'}
  </ul>
</body>
</html>`;

    const textContent = `Daily Progress Report - Daily Score: ${dailyScore}/10 (+${bonusScore.toFixed(1)})\n\n` +
      `Task Completion Rate: ${rate}%\n` +
      `Summary / Reflection Analysis: ${summary}\n\n` +
      `Wins Today:\n${wins.map((w: string) => `- ${w}`).join('\n') || 'None'}\n\n` +
      `Areas of Improvement / Bottlenecks:\n${improvements.map((i: string) => `- ${i}`).join('\n') || 'None'}\n\n` +
      `Coach's Message: ${coachMessage}\n\n` +
      `Tomorrow's Focus:\n${tomorrowFocus.map((tf: string) => `- ${tf}`).join('\n') || 'None'}`;

    try {
      const failedToSend: string[] = [];
      const errors: string[] = [];

      const subjectLine = `[Daily Audit] ${date} | Score: ${dailyScore}/10 (+${bonusScore.toFixed(1)})`;

      for (const recipient of validatedRecipients) {
        try {
          await sendMail({
            to: recipient,
            subject: subjectLine,
            html: htmlContent,
            text: textContent
          });
          console.log(`Daily check-in email sent successfully to ${recipient}.`);
        } catch (sendErr: any) {
          console.error(`Resend send failed for ${recipient}. Error: ${sendErr.message}`);
          failedToSend.push(recipient);
          errors.push(`${recipient}: ${sendErr.message}`);
        }
      }

      if (failedToSend.length > 0) {
        await dbStore.createFailedEmail(
          failedToSend,
          report.subject || `Progress Report for ${date}`,
          htmlContent,
          textContent,
          errors.join('; ')
        );
      } else {
        console.log('Daily check-in email sent successfully via Resend.');
      }
    } catch (sendErr: any) {
      console.error('Resend transaction failed: storing in queue. Error:', sendErr.message);
      await dbStore.createFailedEmail(
        validatedRecipients,
        report.subject || `Progress Report for ${date}`,
        htmlContent,
        textContent,
        sendErr.message
      );
    }
  } catch (err: any) {
    console.error('Fatal failure in daily check-in email processor:', err.message);
  }
}

// GET /api/settings/email-recipients
app.get('/api/settings/email-recipients', async (req, res) => {
  try {
    const settings = await dbStore.getSettings('email_recipients');
    res.json({ recipients: settings?.value || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/email-recipients
app.post('/api/settings/email-recipients', async (req, res) => {
  try {
    const { recipients } = req.body;
    if (!Array.isArray(recipients)) {
      return res.status(400).json({ error: 'Recipients must be an array of email strings' });
    }
    const validated = validateRecipients(recipients);
    const updated = await dbStore.saveSettings('email_recipients', validated);
    res.json({ success: true, recipients: updated.value });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/email/failed
app.get('/api/email/failed', async (req, res) => {
  try {
    const emails = await dbStore.getFailedEmails();
    res.json(emails);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/email/retry
app.post('/api/email/retry', async (req, res) => {
  try {
    const failedEmails = await dbStore.getFailedEmails();
    const pending = failedEmails.filter(e => e.status === 'pending');
    
    let successCount = 0;
    let failedCount = 0;
    
    for (const email of pending) {
      try {
        const failedRecipients: string[] = [];
        const errors: string[] = [];
        
        for (const recipient of email.to) {
          try {
            await sendMail({
              to: recipient,
              subject: email.subject,
              html: email.htmlContent,
              text: email.textContent
            });
          } catch (err: any) {
            failedRecipients.push(recipient);
            errors.push(`${recipient}: ${err.message}`);
          }
        }
        
        if (failedRecipients.length === 0) {
          await dbStore.updateFailedEmail(email.id, 'sent' as any, email.retryCount, '');
          successCount++;
        } else {
          const newCount = email.retryCount + 1;
          const newStatus = newCount >= 3 ? 'failed' : 'pending';
          await dbStore.updateFailedEmail(email.id, newStatus, newCount, errors.join('; '));
          failedCount++;
        }
      } catch (err: any) {
        const newCount = email.retryCount + 1;
        const newStatus = newCount >= 3 ? 'failed' : 'pending';
        await dbStore.updateFailedEmail(email.id, newStatus, newCount, err.message);
        failedCount++;
      }
    }
    
    res.json({
      success: true,
      processed: pending.length,
      successCount,
      failedCount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/email/resend-config
app.get('/api/email/resend-config', async (req, res) => {
  try {
    const customApiKey = await dbStore.getSettings('resend_api_key').catch(() => null);
    const customFrom = await dbStore.getSettings('email_from').catch(() => null);

    res.json({
      resend_api_key: (customApiKey && customApiKey.value && customApiKey.value[0]) ? '********' : '',
      email_from: (customFrom && customFrom.value && customFrom.value[0]) || '',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/email/resend-config
app.post('/api/email/resend-config', async (req, res) => {
  try {
    const { resend_api_key, email_from } = req.body;

    if (resend_api_key !== undefined && resend_api_key !== '********') {
      await dbStore.saveSettings('resend_api_key', [resend_api_key]);
    }
    if (email_from !== undefined) {
      await dbStore.saveSettings('email_from', [email_from]);
    }

    res.json({ success: true, message: 'Resend configuration saved successfully!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/email/test
app.post('/api/email/test', async (req, res) => {
  try {
    const settings = await dbStore.getSettings('email_recipients');
    if (!settings || !settings.value || settings.value.length === 0) {
      return res.status(400).json({ error: 'No recipient emails configured. Please add at least one email address to the recipient list first.' });
    }

    const validatedRecipients = validateRecipients(settings.value);
    if (validatedRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid recipient email addresses found in your configuration.' });
    }

    const customApiKey = await dbStore.getSettings('resend_api_key').catch(() => null);
    const customFrom = await dbStore.getSettings('email_from').catch(() => null);

    const resendApiKey = (customApiKey && customApiKey.value && customApiKey.value[0]) || process.env.RESEND_API_KEY || '';
    const emailFrom = (customFrom && customFrom.value && customFrom.value[0]) || process.env.EMAIL_FROM || "Productivity App <onboarding@resend.dev>";

    if (!resendApiKey) {
      return res.status(400).json({ error: 'Resend API Key is not configured. Please define it in environment secrets or enter it in App Settings below first.' });
    }

    const testSubject = 'AI Progress Email System - Diagnostic Resend API Test';
    const htmlContent = `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; padding: 20px; background-color: #f8fafc; color: #0f172a;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 4px solid #0f172a; padding: 24px; box-shadow: 6px 6px 0px 0px rgba(15,23,42,1);">
    <h1 style="font-size: 20px; font-weight: 900; margin-top: 0; text-transform: uppercase; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
      Diagnostic Resend API Connection Test
    </h1>
    <p style="font-size: 14px; font-weight: 700; line-height: 1.6;">
      Congratulations! Your Resend API integration is working perfectly.
    </p>
    <p style="font-size: 12px; font-weight: 600; color: #475569; background-color: #f1f5f9; padding: 12px; border-left: 4px solid #4f46e5; font-family: monospace;">
      Provider: Resend Email API<br>
      From Address: ${emailFrom}<br>
      Timestamp: ${new Date().toISOString()}
    </p>
    <p style="font-size: 13px; font-weight: 500; color: #334155;">
      You will now receive automated summaries generated by Google Gemini AI directly to this inbox whenever you submit a check-in page log!
    </p>
    <div style="text-align: center; margin-top: 24px; border-top: 2px solid #e2e8f0; padding-top: 16px;">
      <span style="font-size: 10px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b;">
        AI Daily Check-In Companion System
      </span>
    </div>
  </div>
</body>
</html>`;

    const textContent = `AI Progress Email System - Diagnostic Resend API Test\n\n` +
      `Congratulations! Your Resend API integration is working perfectly.\n\n` +
      `Diagnostic Details:\n` +
      `- Provider: Resend Email API\n` +
      `- From Address: ${emailFrom}\n` +
      `- Time: ${new Date().toISOString()}\n\n` +
      `You will now receive automated summaries generated by Google Gemini AI directly to this inbox whenever you submit a check-in page log!`;

    const failedToSend: string[] = [];
    const errors: string[] = [];

    for (const recipient of validatedRecipients) {
      try {
        await sendMail({
          from: emailFrom,
          to: recipient,
          subject: testSubject,
          html: htmlContent,
          text: textContent
        });
      } catch (err: any) {
        failedToSend.push(recipient);
        errors.push(`${recipient}: ${err.message}`);
      }
    }

    if (failedToSend.length > 0) {
      throw new Error(`Failed to send to some recipients: ${errors.join(', ')}`);
    }

    res.json({ success: true, message: `Diagnostic Resend API test email sent successfully to: ${validatedRecipients.join(', ')}!` });
  } catch (error: any) {
    // Write failed attempt to queue for review
    const settings = await dbStore.getSettings('email_recipients').catch(() => null);
    const recipients = settings?.value || ['unknown@test.com'];
    await dbStore.createFailedEmail(
      recipients,
      'Diagnostic Resend Test (Failed)',
      'Resend Diagnostic failed to execute',
      'Resend Diagnostic failed to execute',
      error.message
    ).catch(err => console.error('Failed to log failed email test error:', err));

    res.status(500).json({ error: error.message });
  }
});


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
    
    // Run initial task cycles check on boot
    runTaskCycleCheck().catch((err) => {
      console.error('Task System: Initial task cycle check failed on boot:', err);
    });

    // Schedule hourly task cycle check
    setInterval(() => {
      runTaskCycleCheck().catch((err) => {
        console.error('Task System: Background periodic cycle check failed:', err);
      });
    }, 3600000); // 1 hour
  });
}

startServer();
