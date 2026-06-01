import { dbStore } from '../db';
import { Task } from '../types';

let dateOverride: string | null = null;

export function setDateOverride(date: string | null) {
  dateOverride = date;
}

export function getDateOverride(): string | null {
  return dateOverride;
}

export function getTodayString(): string {
  if (dateOverride) return dateOverride;
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateParts(dateStr: string) {
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10) - 1,
    day: parseInt(parts[2], 10)
  };
}

export function createLocalDate(dateStr: string): Date {
  const { year, month, day } = parseDateParts(dateStr);
  return new Date(year, month, day);
}

export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMondayOfWeek(dateStr: string): string {
  const d = createLocalDate(dateStr);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return toDateString(monday);
}

export function getSundayOfWeek(dateStr: string): string {
  const d = createLocalDate(dateStr);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = d.getDate() - day + (day === 0 ? 0 : 7);
  const sunday = new Date(d.setDate(diff));
  return toDateString(sunday);
}

export function getMonthStartAndEnd(dateStr: string) {
  const { year, month } = parseDateParts(dateStr);
  const s = new Date(year, month, 1);
  const e = new Date(year, month + 1, 0);
  return {
    start: toDateString(s),
    end: toDateString(e)
  };
}

export function getCycleRange(
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'scheduled' | 'unscheduled',
  dateStr: string,
  scheduleDate: string | null = null
) {
  if (type === 'daily') {
    return { start: dateStr, end: dateStr };
  }
  if (type === 'weekly') {
    return {
      start: getMondayOfWeek(dateStr),
      end: getSundayOfWeek(dateStr)
    };
  }
  if (type === 'monthly') {
    return getMonthStartAndEnd(dateStr);
  }
  if (type === 'yearly') {
    const year = dateStr.split('-')[0];
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`
    };
  }
  if (type === 'scheduled') {
    const sDate = scheduleDate || dateStr;
    return { start: sDate, end: sDate };
  }
  return { start: null, end: null };
}

export async function getLastCycleCheckDate(): Promise<string | null> {
  const settingsItem = await dbStore.getSettings('last_cycle_check_date');
  if (settingsItem && settingsItem.value && settingsItem.value.length > 0) {
    return settingsItem.value[0];
  }
  return null;
}

export async function saveLastCycleCheckDate(dateStr: string): Promise<void> {
  await dbStore.saveSettings('last_cycle_check_date', [dateStr]);
}

export async function runTaskCycleCheck() {
  const today = getTodayString();
  let lastRun = await getLastCycleCheckDate();

  if (!lastRun) {
    // If no last run recorded, default to today
    await saveLastCycleCheckDate(today);
    console.log(`Initialized task cycle last run date to ${today}.`);

    // Pre-initialize any active tasks with null cycleStart/cycleEnd
    const tasks = await dbStore.getTasks();
    for (const task of tasks) {
      if ((task.status === 'active' || !task.status) && (!task.cycleStart || !task.cycleEnd)) {
        let baseDate = today;
        if (task.createdAt) {
          try { baseDate = task.createdAt.slice(0, 10); } catch(e){}
        }
        const { start, end } = getCycleRange(task.type, baseDate, task.scheduleDate);
        await dbStore.updateTask(task.id, {
          cycleStart: start,
          cycleEnd: end,
          status: 'active'
        });
      }
    }
    return;
  }

  if (lastRun === today) {
    return;
  }

  console.log(`Task System: Running cycle check simulation from ${lastRun} to ${today}`);

  // Catch up missing days
  const datesToProcess: string[] = [];
  const currentD = createLocalDate(lastRun);

  while (true) {
    currentD.setDate(currentD.getDate() + 1);
    const currStr = toDateString(currentD);
    if (currStr > today) {
      break;
    }
    datesToProcess.push(currStr);
  }

  for (const processDate of datesToProcess) {
    console.log(`Processing task cycles for date: ${processDate}`);
    const tasks = await dbStore.getTasks();

    for (const task of tasks) {
      const statusValue = task.status || 'active';
      if (statusValue !== 'active') {
        continue;
      }

      if (!task.cycleEnd) {
        continue;
      }

      if (task.cycleEnd < processDate) {
        const nextStatus = task.completed ? 'completed' : 'missed';

        console.log(`Task #${task.id} (${task.title}, type: ${task.type}) ended at ${task.cycleEnd}. Setting status to ${nextStatus}.`);

        // Update target task status
        await dbStore.updateTask(task.id, { status: nextStatus });

        // Regenerate if recurring
        if (['daily', 'weekly', 'monthly', 'yearly'].includes(task.type)) {
          const { start: newStart, end: newEnd } = getCycleRange(task.type, processDate);
          console.log(`Regenerating recurring task: ${task.title} (${newStart} to ${newEnd})`);
          await dbStore.createTask(
            task.title,
            task.category,
            task.type,
            null,
            newStart,
            newEnd,
            'active'
          );
        }
      }
    }
  }


  await saveLastCycleCheckDate(today);
  console.log(`Task cycles up to date. Saved last run date as ${today}.`);
}

export async function forceResetCycle(type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all') {
  const tasks = await dbStore.getTasks();
  const today = getTodayString();
  
  // 1. Identify active recurring task definitions
  const activeDefinitions = new Map<string, Pick<Task, 'title' | 'category' | 'type' | 'scheduleDate'>>();
  
  for (const task of tasks) {
    if (task.status === 'active' && (type === 'all' || task.type === type)) {
      // Mark old task as expired (missed)
      await dbStore.updateTask(task.id, { status: 'missed' });

      // Store definition to recreate
      if (['daily', 'weekly', 'monthly', 'yearly'].includes(task.type)) {
        const defKey = `${task.title}_${task.category}_${task.type}`;
        if (!activeDefinitions.has(defKey)) {
          activeDefinitions.set(defKey, {
            title: task.title,
            category: task.category,
            type: task.type,
            scheduleDate: task.scheduleDate
          });
        }
      }
    }
  }

  // 2. Recreate tasks based on definitions for the current cycle
  for (const def of activeDefinitions.values()) {
    const { start, end } = getCycleRange(def.type, today, def.scheduleDate || null);
    await dbStore.createTask(
      def.title,
      def.category,
      def.type,
      def.scheduleDate, // Replicate original scheduleDate if any
      start,
      end,
      'active'
    );
  }
}
