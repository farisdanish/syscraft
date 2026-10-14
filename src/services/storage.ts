import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import type { 
  ExportEnvelopeV1, 
  HesitationLogItem, 
  OralRubricScore, 
  TaskState, 
  TaskStatus, 
  DrillSessionState 
} from '../types';

interface SysCraftDB extends DBSchema {
  progress: {
    key: string;
    value: {
      drillId: string;
      completed: boolean;
      verified: boolean;
      verificationSource?: 'simulation' | 'local-runtime' | 'self-reported';
      completedAt: string;
      attempts: number;
    };
  };
  tasks: {
    key: string;
    value: TaskState;
  };
  drillSessions: {
    key: string;
    value: DrillSessionState;
  };
  hesitations: {
    key: string;
    value: HesitationLogItem;
    indexes: { 'by-sunday': string };
  };
  oralScores: {
    key: string;
    value: OralRubricScore;
  };
  notes: {
    key: string;
    value: { drillId: string; content: string; updatedAt: string };
  };
}

const DB_NAME = 'syscraft_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<SysCraftDB>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<SysCraftDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SysCraftDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'drillId' });
        }
        if (!db.objectStoreNames.contains('hesitations')) {
          const hesitationStore = db.createObjectStore('hesitations', { keyPath: 'id' });
          hesitationStore.createIndex('by-sunday', 'reviewedSunday');
        }
        if (!db.objectStoreNames.contains('oralScores')) {
          db.createObjectStore('oralScores', { keyPath: 'timestamp' });
        }
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'drillId' });
        }

        // DB Version 2: Task catalog state and granular drill session stores
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'taskId' });
        }
        if (!db.objectStoreNames.contains('drillSessions')) {
          db.createObjectStore('drillSessions', { keyPath: 'drillId' });
        }

        // Automatic non-destructive migration from v1 progress to v2 tasks
        if (oldVersion < 2 && db.objectStoreNames.contains('progress')) {
          const progressStore = transaction.objectStore('progress');
          const tasksStore = transaction.objectStore('tasks');
          const records = await progressStore.getAll();
          for (const p of records) {
            const status: TaskStatus = p.completed
              ? (p.verified && p.verificationSource === 'local-runtime' ? 'verified' : 'completed')
              : (p.attempts > 0 ? 'in_progress' : 'available');
            await tasksStore.put({
              taskId: p.drillId,
              status,
              attempts: p.attempts || 1,
              verificationSource: p.verificationSource || 'simulation',
              completedAt: p.completed ? p.completedAt : undefined,
              lastOpenedAt: p.completedAt,
            });
          }
        }
      },
    });
  }
  return dbPromise;
}

// Progress Operations (Legacy & Cross-Compatibility)
export async function saveDrillProgress(
  drillId: string, 
  completed: boolean, 
  verified: boolean,
  verificationSource: 'simulation' | 'local-runtime' | 'self-reported' = 'simulation'
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get('progress', drillId);
  const completedAt = new Date().toISOString();
  await db.put('progress', {
    drillId,
    completed,
    verified,
    verificationSource,
    completedAt,
    attempts: (existing?.attempts || 0) + 1,
  });

  // Also synchronize with tasks store
  const existingTask = await db.get('tasks', drillId);
  const status: TaskStatus = completed
    ? (verified && verificationSource === 'local-runtime' ? 'verified' : 'completed')
    : 'in_progress';
  await db.put('tasks', {
    taskId: drillId,
    status,
    attempts: (existingTask?.attempts || 0) + 1,
    verificationSource,
    completedAt: completed ? completedAt : existingTask?.completedAt,
    lastOpenedAt: completedAt,
  });
}

export async function getDrillProgress(drillId: string) {
  const db = await getDatabase();
  return db.get('progress', drillId);
}

export async function getAllProgress() {
  const db = await getDatabase();
  return db.getAll('progress');
}

// Task State Operations
export async function getTaskState(taskId: string): Promise<TaskState | undefined> {
  const db = await getDatabase();
  return db.get('tasks', taskId);
}

export async function saveTaskState(state: TaskState): Promise<void> {
  const db = await getDatabase();
  await db.put('tasks', state);
}

export async function getAllTaskStates(): Promise<TaskState[]> {
  const db = await getDatabase();
  return db.getAll('tasks');
}

// Granular Drill Session Operations
export async function getDrillSession(drillId: string): Promise<DrillSessionState | undefined> {
  const db = await getDatabase();
  return db.get('drillSessions', drillId);
}

export async function saveDrillSession(session: DrillSessionState): Promise<void> {
  const db = await getDatabase();
  await db.put('drillSessions', session);
}

export async function getAllDrillSessions(): Promise<DrillSessionState[]> {
  const db = await getDatabase();
  return db.getAll('drillSessions');
}

// Hesitation Tracker Operations
export async function logHesitation(item: Omit<HesitationLogItem, 'id' | 'createdAt' | 'reviewedSunday'>): Promise<string> {
  const db = await getDatabase();
  const id = `hesitation_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: HesitationLogItem = {
    ...item,
    id,
    createdAt: new Date().toISOString(),
    reviewedSunday: false,
  };
  await db.put('hesitations', record);
  return id;
}

export async function getSundayHesitations(): Promise<HesitationLogItem[]> {
  const db = await getDatabase();
  const all = await db.getAll('hesitations');
  return all.filter(h => !h.reviewedSunday);
}

export async function markHesitationReviewed(id: string): Promise<void> {
  const db = await getDatabase();
  const record = await db.get('hesitations', id);
  if (record) {
    record.reviewedSunday = true;
    await db.put('hesitations', record);
  }
}

// Oral Rubric Operations
export async function saveOralScore(score: OralRubricScore): Promise<void> {
  const db = await getDatabase();
  await db.put('oralScores', score);
}

export async function getOralScores(drillId?: string): Promise<OralRubricScore[]> {
  const db = await getDatabase();
  const all = await db.getAll('oralScores');
  if (drillId) {
    return all.filter(s => s.drillId === drillId);
  }
  return all;
}

// Note Operations
export async function saveCustomNote(drillId: string, content: string): Promise<void> {
  const db = await getDatabase();
  await db.put('notes', { drillId, content, updatedAt: new Date().toISOString() });
}

export async function getCustomNote(drillId: string): Promise<string> {
  const db = await getDatabase();
  const record = await db.get('notes', drillId);
  return record?.content || '';
}

// Distinct Reset Semantics
export async function clearLearnerProgress(): Promise<void> {
  const db = await getDatabase();
  const stores = ['tasks', 'drillSessions', 'progress', 'hesitations', 'oralScores', 'notes'] as const;
  for (const store of stores) {
    try {
      if (db.objectStoreNames.contains(store)) {
        await db.clear(store);
      }
    } catch (err) {
      console.warn(`[storage] Could not clear store ${store}:`, err);
    }
  }
}

// Export / Import Validation Schemas (Strict Zod Validation)
const HesitationSchema = z.object({
  id: z.string(),
  drillId: z.string(),
  week: z.number(),
  topic: z.string(),
  timeToFirstActionSeconds: z.number(),
  retryCount: z.number(),
  hintsRequested: z.number(),
  failedAssertionCount: z.number(),
  rubricMisses: z.array(z.string().max(500)),
  learnerFlagged: z.boolean(),
  createdAt: z.string(),
  reviewedSunday: z.boolean(),
});

const OralRubricScoreSchema = z.object({
  drillId: z.string(),
  timestamp: z.string(),
  dimensionScores: z.object({
    correctness: z.number().min(1).max(4),
    tradeoff: z.number().min(1).max(4),
    failure: z.number().min(1).max(4),
    clarity: z.number().min(1).max(4),
    challenge: z.number().min(1).max(4),
  }),
  durationSeconds: z.number(),
  unscriptedPass: z.boolean(),
  notes: z.string().max(2000),
});

const TaskStateSchema = z.object({
  taskId: z.string(),
  status: z.enum(['locked', 'available', 'in_progress', 'completed', 'verified', 'deferred', 'planned']),
  attempts: z.number(),
  verificationSource: z.enum(['simulation', 'local-runtime', 'self-reported']).optional(),
  lastOpenedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

const DrillStepCompletionsSchema = z.object({
  1: z.boolean(),
  2: z.boolean(),
  3: z.boolean(),
  4: z.boolean(),
  5: z.boolean(),
});

const DrillSessionStateSchema = z.object({
  drillId: z.string(),
  week: z.number(),
  currentStep: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  highestStepReached: z.number(),
  stepCompletions: DrillStepCompletionsSchema,
  draftCode: z.string().max(50000),
  testResults: z.unknown().nullable().optional(),
  tier3Result: z.unknown().nullable().optional(),
  verificationSource: z.enum(['simulation', 'local-runtime', 'self-reported']),
  completed: z.boolean(),
  oralDefenseCompleted: z.boolean(),
  lastActiveAt: z.string(),
});

const EnvelopeSchema = z.object({
  schemaVersion: z.string().regex(/^1\.\d+\.\d+$/),
  exportedAt: z.string(),
  appVersion: z.string().regex(/^1\.\d+\.\d+$/),
  payload: z.object({
    tasks: z.record(z.string(), TaskStateSchema).optional(),
    completedDrills: z.record(z.string(), z.object({
      completed: z.boolean(),
      score: z.number().optional(),
      verified: z.boolean(),
      verificationSource: z.enum(['simulation', 'local-runtime', 'self-reported']).optional(),
    })),
    drillSessions: z.record(z.string(), DrillSessionStateSchema).optional(),
    hesitations: z.array(HesitationSchema),
    oralScores: z.array(OralRubricScoreSchema),
    customNotes: z.record(z.string(), z.string().max(10000)),
  }),
});

// Recursive object depth guard
function checkObjectDepth(obj: unknown, maxDepth = 6, currentDepth = 0): boolean {
  if (currentDepth > maxDepth) return false;
  if (typeof obj !== 'object' || obj === null) return true;
  for (const key of Object.keys(obj)) {
    if (!checkObjectDepth((obj as Record<string, unknown>)[key], maxDepth, currentDepth + 1)) {
      return false;
    }
  }
  return true;
}

export async function exportEnvelopeJSON(): Promise<string> {
  const db = await getDatabase();
  const progressList = await db.getAll('progress');
  const taskList = await db.getAll('tasks');
  const sessionList = await db.getAll('drillSessions');
  const hesitations = await db.getAll('hesitations');
  const oralScores = await db.getAll('oralScores');
  const notesList = await db.getAll('notes');

  const completedDrills: Record<string, { completed: boolean; score?: number; verified: boolean; verificationSource?: 'simulation' | 'local-runtime' | 'self-reported' }> = {};
  for (const p of progressList) {
    completedDrills[p.drillId] = { 
      completed: p.completed, 
      verified: p.verified,
      verificationSource: p.verificationSource || 'simulation',
    };
  }

  const tasks: Record<string, TaskState> = {};
  for (const t of taskList) {
    tasks[t.taskId] = t;
  }

  const drillSessions: Record<string, DrillSessionState> = {};
  for (const s of sessionList) {
    drillSessions[s.drillId] = s;
  }

  const customNotes: Record<string, string> = {};
  for (const n of notesList) {
    customNotes[n.drillId] = n.content;
  }

  const envelope: ExportEnvelopeV1 = {
    schemaVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    payload: {
      tasks,
      completedDrills,
      drillSessions,
      hesitations,
      oralScores,
      customNotes,
    },
  };

  return JSON.stringify(envelope, null, 2);
}

// Prototype-Pollution-Safe JSON Import with Strict Depth & Size Guards
export async function importEnvelopeJSON(jsonString: string): Promise<{ success: boolean; message: string }> {
  if (jsonString.length > 2 * 1024 * 1024) {
    return { success: false, message: 'Payload exceeds maximum permitted size of 2MB.' };
  }

  try {
    const parsed = JSON.parse(jsonString, (key, value) => {
      if (key === '__proto__' || key === 'constructor') {
        return undefined;
      }
      return value;
    });

    if (!checkObjectDepth(parsed, 6)) {
      return { success: false, message: 'Payload rejected: Object nesting exceeds maximum permitted depth of 6.' };
    }

    const validated = EnvelopeSchema.parse(parsed);
    const db = await getDatabase();

    for (const [drillId, val] of Object.entries(validated.payload.completedDrills)) {
      await db.put('progress', {
        drillId,
        completed: val.completed,
        verified: val.verified,
        verificationSource: val.verificationSource || 'simulation',
        completedAt: new Date().toISOString(),
        attempts: 1,
      });
    }

    if (validated.payload.tasks) {
      for (const task of Object.values(validated.payload.tasks)) {
        if (task.taskId) {
          await db.put('tasks', task);
        }
      }
    }

    if (validated.payload.drillSessions) {
      for (const session of Object.values(validated.payload.drillSessions)) {
        if (session.drillId) {
          await db.put('drillSessions', {
            ...session,
            testResults: session.testResults ?? null,
            tier3Result: session.tier3Result ?? null,
          });
        }
      }
    }

    for (const h of validated.payload.hesitations) {
      if (h.id && h.drillId) {
        await db.put('hesitations', h);
      }
    }

    for (const score of validated.payload.oralScores) {
      if (score.timestamp && score.drillId) {
        await db.put('oralScores', score);
      }
    }

    if (validated.payload.customNotes) {
      for (const [drillId, content] of Object.entries(validated.payload.customNotes)) {
        if (typeof content === 'string') {
          await db.put('notes', { drillId, content, updatedAt: new Date().toISOString() });
        }
      }
    }

    return { success: true, message: 'Backup imported, schema-validated, and restored successfully.' };
  } catch (err: any) {
    return { success: false, message: `Import validation failed: ${err.message || 'Malformed schema'}` };
  }
}
